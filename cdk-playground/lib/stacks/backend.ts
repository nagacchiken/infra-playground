import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as firehose from "aws-cdk-lib/aws-kinesisfirehose";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";
import { Lambda } from "aws-cdk-lib/aws-ses-actions";

export class BackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = ec2.Vpc.fromLookup(this, "DefaultVpc", {
      isDefault: true, // デフォルトVPC自動取得
    });

    const accountEnv = "sandbox";

    const bucket = new s3.Bucket(this, "LoggingBucket", {
      bucketName: `${accountEnv}-backend-logging-bucket`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    const firehoseStream = new firehose.DeliveryStream(
      this,
      "LoggingDeliveryStream",
      {
        deliveryStreamName: `backend-logging-delivery-stream`,
        destination: new firehose.S3Bucket(bucket),
      }
    );

    const ec2Role = new iam.Role(this, "SsmInstanceRole", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
    });
    ec2Role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore")
    );

    ec2Role.addToPolicy(
      new iam.PolicyStatement({
        actions: ["firehose:PutRecord", "firehose:PutRecordBatch"],
        resources: [firehoseStream.deliveryStreamArn],
      })
    );

    const ec2Instance = new ec2.Instance(this, "Ec2Instance", {
      vpc,
      instanceType: new ec2.InstanceType("t3.micro"),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      role: ec2Role,
      userData: ec2.UserData.custom(`
#!/bin/bash
set -e
cat <<EOF > /etc/yum.repos.d/fluent-bit.repo
[fluent-bit]
name = Fluent Bit
baseurl = https://packages.fluentbit.io/amazonlinux/2023/
gpgcheck=1
gpgkey=https://packages.fluentbit.io/fluentbit.key
enabled=1
EOF

yum update -y && yum install -y fluent-bit

cat > /etc/fluent-bit/fluent-bit.conf << 'EOF'
[SERVICE]
    Flush        5
    Log_Level    info

[INPUT]
    Name tail
    Path /var/log/messages
    Tag  system.*

[OUTPUT]
    Name kinesis_firehose
    Match *
    region ap-northeast-1
    delivery_stream backend-logging-delivery-stream
EOF

yum update -y && yum install -y fluent-bit
systemctl daemon-reload
systemctl enable fluent-bit
systemctl start fluent-bit

# テストログ生成
echo "=== HELLO WORLD $(date) ===" >> /var/log/messages
    `),
    });

    // const helloWorldLambda = new lambda.Function(this, "HelloWorldLambda", {
    //   runtime: lambda.Runtime.NODEJS_22_X,
    //   handler: "index.handler",
    //   code: lambda.Code.fromInline(`
    //     exports.handler = async (event) => {
    //       console.log("hello world");

    //       return {
    //         statusCode: 200,
    //         body: JSON.stringify({ message: "Hello from Lambda!" })
    //       };
    //     };
    //   `),
    // });
  }
}
