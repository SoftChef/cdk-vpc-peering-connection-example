import {
  CfnRoute,
  CfnVPCPeeringConnection,
  SubnetType,
  Vpc,
} from '@aws-cdk/aws-ec2';
import {
  AccountPrincipal,
  Effect,
  PolicyStatement,
  Role,
} from '@aws-cdk/aws-iam';
import {
  App,
  CfnOutput,
  Construct,
  Stack,
  StackProps,
} from '@aws-cdk/core';
import * as dotenv from 'dotenv';

dotenv.config();

export class CrossVpcMasterStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);
    const slaveVpcId = scope.node.tryGetContext('SlaveVpcId');
    const slaveVpcPeeringConnectionAcceptRoleArn = scope.node.tryGetContext('SlaveVpcPeeringConnectionAcceptRoleArn');
    if (!slaveVpcId || !slaveVpcPeeringConnectionAcceptRoleArn) {
      return;
    }
    const vpc = new Vpc(this, 'MasterVpc', {
      cidr: process.env.MASTER_VPC_CIDR,
      natGateways: 0,
      maxAzs: 2,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: SubnetType.PUBLIC,
        },
      ],
    });
    const vpcPeeringConnection = new CfnVPCPeeringConnection(this, 'Peering', {
      vpcId: vpc.vpcId,
      peerOwnerId: process.env.SLAVE_ACCOUNT,
      peerRegion: process.env.SLAVE_REGION,
      peerVpcId: slaveVpcId,
      peerRoleArn: slaveVpcPeeringConnectionAcceptRoleArn,
    });
    vpc.publicSubnets.forEach(({ routeTable: { routeTableId } }, index) => {
      new CfnRoute(this, `PublicSubnetPeeringConnectionRoute-${index}`, {
        routeTableId,
        destinationCidrBlock: process.env.SLAVE_VPC_CIDR,
        vpcPeeringConnectionId: vpcPeeringConnection.ref,
      });
    });
    new CfnOutput(this, 'VpcId', {
      value: vpc.vpcId,
    });
    new CfnOutput(this, 'VpcPeeringConnectionId', {
      value: vpcPeeringConnection.ref,
    });
  }
}

export class CrossVpcSlaveStack extends Stack {

  public vpcPeeringConnectionAcceptRole: Role;

  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);
    this.vpcPeeringConnectionAcceptRole = new Role(this, 'VpcPeeringConnectionAcceptRole', {
      assumedBy: new AccountPrincipal(process.env.MASTER_ACCOUNT),
    });
    this.vpcPeeringConnectionAcceptRole.addToPolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
          'ec2:AcceptVpcPeeringConnection',
        ],
        resources: ['*'],
      }),
    );
    const vpc = new Vpc(this, 'SlaveVpc', {
      cidr: process.env.SLAVE_VPC_CIDR,
      natGateways: 0,
      maxAzs: 2,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: SubnetType.PUBLIC,
        },
      ],
    });
    const vpcPeeringConnectionId = scope.node.tryGetContext('VpcPeeringConnectionId');
    if (vpcPeeringConnectionId) {
      vpc.publicSubnets.forEach(({ routeTable: { routeTableId } }, index) => {
        new CfnRoute(this, `PublicSubnetPeeringConnectionRoute-${index}`, {
          routeTableId,
          destinationCidrBlock: process.env.MASTER_VPC_CIDR,
          vpcPeeringConnectionId: vpcPeeringConnectionId,
        });
      });
    }
    new CfnOutput(this, 'VpcId', {
      value: vpc.vpcId,
    });
    new CfnOutput(this, 'VpcPeeringConnectionAcceptRoleArn', {
      value: this.vpcPeeringConnectionAcceptRole.roleArn,
    });
  }
}

const app = new App();

new CrossVpcMasterStack(app, process.env.MASTER_STACK_NAME!, {
  env: {
    account: process.env.MASTER_ACCOUNT,
    region: process.env.MASTER_REGION,
  },
});

new CrossVpcSlaveStack(app, process.env.SLAVE_STACK_NAME!, {
  env: {
    account: process.env.SLAVE_ACCOUNT,
    region: process.env.SLAVE_REGION,
  },
});


app.synth();