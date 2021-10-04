const { spawnSync } = require('child_process');
const dotenv = require('dotenv');
const { readFileSync } = require('fs');
const awsConfig = require('rc')('aws');
const yargs = require('yargs')
  .alias(
    'master-profile', 'mp'
  )
  .alias(
    'slave-profile', 'sp'
  )
  .describe('mp', 'Specify AWS profile with master account')
  .describe('sp', 'Specify AWS profile with slave account')
  .check(
    (argv) => {
      let error = [];
      if (!(awsConfig[argv.masterProfile] || awsConfig[`profile ${argv.masterProfile}`])) {
        error.push('master account profile is invalid');
      }
      if (!(awsConfig[argv.slaveProfile] || awsConfig[`profile ${argv.slaveProfile}`])) {
        error.push('slave account profile is invalid');
      }
      if (error.length > 0) {
        throw new Error(error.join(', '));
      } else {
        return true;
      }
    }
  )
  .argv;

dotenv.config();

const spawnOptions = {
  shell: true,
  stdio: 'inherit'
};

const loadMasterOutput = () => {
  return loadOutput('master', process.env.MASTER_STACK_NAME);
}

const loadSlaveOutput = () => {
  return loadOutput('slave', process.env.SLAVE_STACK_NAME);
}

const loadOutput = async(target, stackName) => {
  const outputJson = readFileSync(`./${target}-outputs.json`);
  const output = JSON.parse(outputJson.toString())
  if (output[stackName]) {
    return Promise.resolve(output[stackName]);
  } else {
    return Promise.reject(`${stackName} output not exists`);
  }
}
exports.handler = async() => {
  try {
    // Deploy slave stack
    await spawnSync('cdk', [
      'deploy', process.env.SLAVE_STACK_NAME,
      '--require-approval', 'never',
      '--profile', yargs.slaveProfile,
      '--outputs-file', 'slave-outputs.json'
    ], spawnOptions);
    // Load slave stack's outputs
    const slaveOutput = await loadSlaveOutput();
    // Deploy master stack with slave stack resource
    await spawnSync('cdk', [
      'deploy', process.env.MASTER_STACK_NAME,
      '--require-approval', 'never',
      '--context', `SlaveVpcId=${slaveOutput.VpcId}`,
      '--context', `SlaveVpcPeeringConnectionAcceptRoleArn=${slaveOutput.VpcPeeringConnectionAcceptRoleArn}`,
      '--profile', yargs.masterProfile,
      '--outputs-file', 'master-outputs.json'
    ], spawnOptions);
    // Load master stack's outputs
    const masterOutput = await loadMasterOutput();
    // Update slave stack with master stack resource
    await spawnSync('cdk', [
      'deploy', process.env.SLAVE_STACK_NAME,
      '--require-approval', 'never',
      '--context', `VpcPeeringConnectionId=${masterOutput.VpcPeeringConnectionId}`,
      '--profile', yargs.slaveProfile,
      '--outputs-file', 'slave-outputs.json'
    ], spawnOptions);
  } catch(error) {
    console.error(error)
  }
}

this.handler();