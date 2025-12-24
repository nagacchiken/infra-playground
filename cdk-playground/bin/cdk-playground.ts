import * as cdk from "aws-cdk-lib";
import { NetworkStack } from "../lib/stacks/network";
import { BackendStack } from "../lib/stacks/backend";

const app = new cdk.App();

// new NetworkStack(app, "NetworkStack", {
//     env: {
//       account: process.env.CDK_DEFAULT_ACCOUNT,
//       region: process.env.CDK_DEFAULT_REGION,
//     },
// });

new BackendStack(app, "Backend", {
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION,
    },
});