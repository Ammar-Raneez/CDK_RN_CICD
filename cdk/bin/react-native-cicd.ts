#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ReactNativeCicdStack } from '../lib/react-native-cicd-stack';
import { env } from '../environments/environment.dev';

const app = new cdk.App();
new ReactNativeCicdStack(app, 'ReactNativeCicdStack', env);
