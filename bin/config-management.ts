#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { ConfigManagementStack } from '../lib/config-management-stack';

const app = new cdk.App();
new ConfigManagementStack(app, 'ConfigManagementStack');
