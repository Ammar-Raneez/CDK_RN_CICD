import { StackProps } from 'aws-cdk-lib';

export interface InfrastructureProps extends StackProps {
  readonly stageName: string;
}
