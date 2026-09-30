export type SupportedLanguage =
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'java'
  | 'cpp'
  | 'csharp'
  | 'go'
  | 'rust'
  | 'php'
  | 'ruby'
  | 'kotlin'
  | 'swift'
  | 'sql'
  | 'html'
  | 'css'
  | 'json'
  | 'yaml'
  | 'markdown'
  | 'other';

export type CommentDensity = 'minimal' | 'standard' | 'teaching';

export interface SourceFile {
  id: string;
  filename: string;
  language: SupportedLanguage;
  content: string;
  size?: number;
  isSelected?: boolean;
}

export interface CodeInsight {
  type: 'algorithm' | 'architecture' | 'edge-case' | 'pattern' | 'best-practice';
  title: string;
  description: string;
  lineRange?: string;
}

export interface InlineCommentsResult {
  commentedCode: string;
  commentarySummary: string;
  keyInsights: CodeInsight[];
  densityUsed: CommentDensity;
}

export interface ArchitectureModule {
  name: string;
  path: string;
  responsibility: string;
  connectsTo: string[];
  keyExports: string[];
}

export interface DesignPatternInfo {
  name: string;
  category: 'Creational' | 'Structural' | 'Behavioral' | 'Architectural';
  location: string;
  rationale: string;
}

export interface ArchitectureResult {
  summary: string;
  modules: ArchitectureModule[];
  designPatterns: DesignPatternInfo[];
  dataFlow: string;
  mermaidDiagram: string;
}

export interface SetupStep {
  stepNumber: number;
  title: string;
  command?: string;
  explanation: string;
}

export interface EnvVariable {
  name: string;
  defaultValue?: string;
  required: boolean;
  description: string;
}

export interface DependencyItem {
  name: string;
  version?: string;
  type: 'runtime' | 'dev';
  purpose: string;
}

export interface SetupGuideResult {
  prerequisites: string[];
  steps: SetupStep[];
  envVariables: EnvVariable[];
  dependencies: DependencyItem[];
  buildDeployTemplate: string;
}

export interface DocuFlowAnalysis {
  id: string;
  timestamp: string;
  density: CommentDensity;
  filesSummary: {
    primaryLanguage: SupportedLanguage;
    totalFiles: number;
    totalLines: number;
    fileNames: string[];
  };
  comments: InlineCommentsResult;
  architecture: ArchitectureResult;
  setupGuide: SetupGuideResult;
  readmeMarkdown: string;
  architectureMarkdown: string;
  setupMarkdown: string;
}

export interface AnalysisProgress {
  stage: 'idle' | 'parsing' | 'commenting' | 'architecting' | 'setup' | 'readme' | 'done';
  message: string;
  percent: number;
}
