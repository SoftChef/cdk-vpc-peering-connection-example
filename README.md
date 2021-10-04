# VPC Peering Connection cross account example with CDK

## Installation

```
npx projen
```

## Deploy example

```
node deploy.js --mp {Your master account AWS profile} --sp {Your slave account AWS profile}
```

When deploy successed, the two VPC are connected, there's CIDR are in the same intranet environment.