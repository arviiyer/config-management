import * as cdk from 'aws-cdk-lib';
import { Stack, StackProps } from 'aws-cdk-lib';
import {
  ManagedRule,
  CfnRemediationConfiguration,
} from 'aws-cdk-lib/aws-config';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export class ConfigManagementStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // **IAM Role for Remediation Actions**
    const remediationRole = new iam.Role(this, 'ConfigRemediationRole', {
      assumedBy: new iam.ServicePrincipal('ssm.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'),
        // You can remove AmazonEC2FullAccess if it's only needed for EBS encryption
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSCloudTrail_FullAccess'),
      ],
    });

    // **S3 Bucket for CloudTrail Logs**
    const trailBucket = new Bucket(this, 'CloudTrailBucket', {
      versioned: true,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
    });

    // **1. Overly Permissive Security Groups**
    const securityGroupRule = new ManagedRule(this, 'SecurityGroupUnrestrictedIngress', {
      identifier: 'INCOMING_SSH_DISABLED',
    });

    new CfnRemediationConfiguration(this, 'SecurityGroupRemediation', {
      configRuleName: securityGroupRule.configRuleName!,
      targetId: 'AWS-DisablePublicAccessForSecurityGroup',
      targetType: 'SSM_DOCUMENT',
      automatic: true,
      maximumAutomaticAttempts: 5,
      retryAttemptSeconds: 60,
      parameters: {
        AutomationAssumeRole: {
          StaticValue: {
            Values: [remediationRole.roleArn],
          },
        },
        GroupId: {
          ResourceValue: {
            Value: 'RESOURCE_ID',
          },
        },
      },
      resourceType: 'AWS::EC2::SecurityGroup',
    });

    // **2. CloudTrail Not Enabled**
    const cloudTrailRule = new ManagedRule(this, 'CloudTrailEnabled', {
      identifier: 'CLOUD_TRAIL_ENABLED',
    });

    new CfnRemediationConfiguration(this, 'CloudTrailRemediation', {
      configRuleName: cloudTrailRule.configRuleName!,
      targetId: 'AWS-EnableCloudTrail',
      targetType: 'SSM_DOCUMENT',
      automatic: true,
      maximumAutomaticAttempts: 5,
      retryAttemptSeconds: 60,
      parameters: {
        AutomationAssumeRole: {
          StaticValue: {
            Values: [remediationRole.roleArn],
          },
        },
        TrailName: {
          StaticValue: {
            Values: ['DefaultTrail'],
          },
        },
        S3BucketName: {
          StaticValue: {
            Values: [trailBucket.bucketName],
          },
        },
        IsMultiRegionTrail: {
          StaticValue: {
            Values: ['true'],
          },
        },
        IsLogging: {
          StaticValue: {
            Values: ['true'],
          },
        },
        IncludeGlobalServiceEvents: {
          StaticValue: {
            Values: ['true'],
          },
        },
      },
    });

    // **3. S3 Versioning Not Enabled**
    const s3VersioningRule = new ManagedRule(this, 'S3BucketVersioningEnabled', {
      identifier: 'S3_BUCKET_VERSIONING_ENABLED',
    });

    new CfnRemediationConfiguration(this, 'S3VersioningRemediation', {
      configRuleName: s3VersioningRule.configRuleName!,
      targetId: 'AWS-ConfigureS3BucketVersioning',
      targetVersion: '1',
      targetType: 'SSM_DOCUMENT',
      automatic: true,
      maximumAutomaticAttempts: 5,
      retryAttemptSeconds: 60,
      parameters: {
        AutomationAssumeRole: {
          StaticValue: {
            Values: [remediationRole.roleArn],
          },
        },
        BucketName: {
          ResourceValue: {
            Value: 'RESOURCE_ID',
          },
        },
        VersioningConfiguration: {
          StaticValue: {
            Values: ['Enabled'],
          },
        },
      },
      resourceType: 'AWS::S3::Bucket',
    });
  }
}
