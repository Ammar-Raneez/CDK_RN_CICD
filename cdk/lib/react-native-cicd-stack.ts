import { Stack } from 'aws-cdk-lib';
import { BuildSpec, LinuxBuildImage, PipelineProject } from 'aws-cdk-lib/aws-codebuild';
import { Artifact, Pipeline } from 'aws-cdk-lib/aws-codepipeline';
import {
  CloudFormationCreateUpdateStackAction,
  CodeBuildAction,
  CodeStarConnectionsSourceAction,
} from 'aws-cdk-lib/aws-codepipeline-actions';
import { Construct } from 'constructs';
import { InfrastructureProps } from '../resources/infrastructure-props.model';

interface ReactNativeCicdStackProps extends InfrastructureProps {
  codeStarConnection: string;
  repo: {
    owner: string;
    name: string;
    branch: string;
  };
}

export class ReactNativeCicdStack extends Stack {
  private readonly pipeline: Pipeline;
  private readonly cdkBuildOutput: Artifact;
  private readonly uiBuildOutput: Artifact;

  constructor(scope: Construct, id: string, props: ReactNativeCicdStackProps) {
    super(scope, id, props);

    this.pipeline = new Pipeline(this, `Pipeline-${props.stageName}`, {
      pipelineName: `Pipeline-${props.stageName}`,
      crossAccountKeys: false,
      restartExecutionOnUpdate: true,              // Restart pipeline on update
    });

    // Add the source as the initial stage (Connection to repo)
    const sourceOutput = new Artifact(`source-output-${props.stageName}`);

    // Add the source to the pipeline
    this.pipeline.addStage({
      stageName: `source-${props.stageName}`,
      actions: [
        new CodeStarConnectionsSourceAction({      // connect via code star
          actionName: `Pipeline-Source-${props.stageName}`,
          owner: props.repo.owner,
          repo: props.repo.name,
          branch: props.repo.branch,
          connectionArn: props.codeStarConnection,
          output: sourceOutput,
        }),
      ],
    });

    // Store our mobile build artifact
    this.uiBuildOutput = new Artifact(`UI-Build-Output-${props.stageName}`);

    // Add our mobile build step
    this.pipeline.addStage({
      stageName: `UI-build-${props.stageName}`,
      actions: [
        new CodeBuildAction({
          input: sourceOutput,
          outputs: [this.uiBuildOutput],
          actionName: `Pipeline-Build-UI-${props.stageName}`,
          project: new PipelineProject(this, `UIBuildProject-${props.stageName}`, {
            environment: {
              buildImage: LinuxBuildImage.AMAZON_LINUX_2_3,
            },
            buildSpec: BuildSpec.fromSourceFilename('mobile-build.yml'),
          }),
        }),
      ],
    });

    // Store our CDK build artifact
    this.cdkBuildOutput = new Artifact(`CDK-build-output-${props.stageName}`);

    // Add CDK build step
    this.pipeline.addStage({
      stageName: `CDK-build-${props.stageName}`,
      actions: [
        new CodeBuildAction({
          input: sourceOutput,
          outputs: [this.cdkBuildOutput],
          actionName: `Pipeline-Build-CDK-${props.stageName}`,
          project: new PipelineProject(this, `CDKBuildProject-${props.stageName}`, {
            environment: {
              buildImage: LinuxBuildImage.STANDARD_5_0,
              privileged: true,
            },
            buildSpec: BuildSpec.fromSourceFilename('cdk-build.yml'),
          }),
        }),
      ],
    });

    // Add cloud formation create/update step
    this.pipeline.addStage({
      stageName: `update-${props.stageName}`,
      actions: [
        new CloudFormationCreateUpdateStackAction({
          actionName: `Pipeline-Update-${props.stageName}`,
          stackName: 'ReactNativeCicdStack',
          templatePath: this.cdkBuildOutput.atPath('ReactNativeCicdStack.template.json'),
          adminPermissions: true,
        }),
      ],
    });
  }
}
