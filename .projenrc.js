const { AwsCdkTypeScriptApp } = require('projen');

const project = new AwsCdkTypeScriptApp({
  authorName: 'SoftChef',
  authorEmail: 'poke@softchef.com',
  authorUrl: 'https://www.softchef.com',
  authorOrganization: true,
  cdkVersion: '1.95.2',
  defaultReleaseBranch: 'main',
  name: 'cdk-vpc-peering-connection-example',
  repositoryUrl: 'https://github.com/SoftChef/cdk-vpc-peering-connection-example.git',
  cdkDependencies: [
    '@aws-cdk/aws-ec2',
    '@aws-cdk/aws-iam',
  ],
  deps: [
    'dotenv',
    'rc',
    'yargs',
  ],
  gitignore: [
    '.env',
    'cdk.context.json',
    '*-outputs.json',
  ],
});

project.synth();