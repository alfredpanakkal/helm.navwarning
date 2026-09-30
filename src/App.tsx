import React, { useState, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import {
  Sparkles,
  Columns,
  Maximize2,
  FileCode,
  FileText,
  AlertCircle,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import {
  SourceFile,
  SupportedLanguage,
  CommentDensity,
  DocuFlowAnalysis,
  AnalysisProgress,
} from './types';
import { CODE_PRESETS, CodePreset } from './data/presets';
import { detectLanguage } from './utils/languageDetector';
import { Header } from './components/Header';
import { CodeEditorPane } from './components/CodeEditorPane';
import { DocumentationPane } from './components/DocumentationPane';
import { ProgressIndicator } from './components/ProgressIndicator';

export function App() {
  // Theme State
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('docuflow-theme');
      if (stored) return stored === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('docuflow-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('docuflow-theme', 'light');
    }
  }, [isDark]);

  // Codebase State
  const defaultPreset = CODE_PRESETS[0];
  const [files, setFiles] = useState<SourceFile[]>(defaultPreset.files);
  const [activeFileId, setActiveFileId] = useState<string>(defaultPreset.files[0].id);
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>(defaultPreset.language);
  const [commentDensity, setCommentDensity] = useState<CommentDensity>('standard');

  // Analysis State
  const [analysis, setAnalysis] = useState<DocuFlowAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isRegeneratingComments, setIsRegeneratingComments] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Progress State
  const [progress, setProgress] = useState<AnalysisProgress>({
    stage: 'idle',
    message: '',
    percent: 0,
  });

  // GitHub Fetch State
  const [isFetchingGithub, setIsFetchingGithub] = useState<boolean>(false);
  const [githubError, setGithubError] = useState<string | null>(null);

  // Layout State: 'split' | 'editor-only' | 'docs-only'
  const [viewMode, setViewMode] = useState<'split' | 'editor-only' | 'docs-only'>('split');
  const [leftPaneWidth, setLeftPaneWidth] = useState<number>(46); // 46% left, 54% right
  const isResizing = useRef<boolean>(false);

  const activeFile = files.find((f) => f.id === activeFileId) || files[0];

  // Auto-detect language when switching active file
  useEffect(() => {
    if (activeFile) {
      const detected = detectLanguage(activeFile.filename, activeFile.content);
      setSelectedLanguage(detected);
    }
  }, [activeFileId, activeFile]);

  // Handle Loading Presets
  const handleLoadPreset = (preset: CodePreset) => {
    setFiles(preset.files);
    setActiveFileId(preset.files[0].id);
    setSelectedLanguage(preset.language);
    setAnalysis(null);
    setAnalysisError(null);
  };

  // File Handlers
  const handleUpdateFileContent = (id: string, newContent: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, content: newContent } : f))
    );
  };

  const handleUpdateFileLanguage = (id: string, lang: SupportedLanguage) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, language: lang } : f))
    );
    setSelectedLanguage(lang);
  };

  const handleAddFile = (newFile: SourceFile) => {
    setFiles((prev) => [...prev, newFile]);
    setActiveFileId(newFile.id);
  };

  const handleDeleteFile = (id: string) => {
    if (files.length <= 1) return;
    const remaining = files.filter((f) => f.id !== id);
    setFiles(remaining);
    if (activeFileId === id) {
      setActiveFileId(remaining[0].id);
    }
  };

  // GitHub Importer
  const handleFetchGithub = async (url: string) => {
    setIsFetchingGithub(true);
    setGithubError(null);
    try {
      const res = await fetch('/api/docuflow/github-fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl: url }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch GitHub repository.');
      }

      if (data.files && data.files.length > 0) {
        const mappedFiles: SourceFile[] = data.files.map((f: any) => ({
          id: f.id,
          filename: f.filename,
          language: detectLanguage(f.filename, f.content),
          content: f.content,
        }));
        setFiles(mappedFiles);
        setActiveFileId(mappedFiles[0].id);
        setSelectedLanguage(mappedFiles[0].language);
        setAnalysis(null);
      }
    } catch (err: any) {
      setGithubError(err.message || 'Error fetching GitHub repository.');
    } finally {
      setIsFetchingGithub(false);
    }
  };

  // Full Analysis Run
  const handleAnalyze = async () => {
    if (files.length === 0 || !activeFile) return;

    setIsAnalyzing(true);
    setAnalysisError(null);

    // Staged progress ticker
    setProgress({
      stage: 'parsing',
      message: `Tokenizing ${files.length} file(s) and checking AST idioms...`,
      percent: 15,
    });

    const timer1 = setTimeout(() => {
      setProgress({
        stage: 'commenting',
        message: `Synthesizing ${commentDensity} inline annotations & invariant commentary...`,
        percent: 42,
      });
    }, 1400);

    const timer2 = setTimeout(() => {
      setProgress({
        stage: 'architecting',
        message: 'Mapping modules, pattern detection, and building Mermaid graph...',
        percent: 68,
      });
    }, 3200);

    const timer3 = setTimeout(() => {
      setProgress({
        stage: 'setup',
        message: 'Synthesizing setup steps, dependency catalog & README.md...',
        percent: 88,
      });
    }, 5400);

    try {
      const res = await fetch('/api/docuflow/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files,
          commentDensity,
          primaryLanguage: selectedLanguage,
        }),
      });

      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to complete code documentation analysis.');
      }

      setProgress({
        stage: 'done',
        message: 'Documentation suite successfully created!',
        percent: 100,
      });

      setAnalysis(result);
    } catch (err: any) {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      console.error('DocuFlow analysis error:', err);
      setAnalysisError(err.message || 'Analysis failed. Please check your code or try again.');
    } finally {
      setTimeout(() => {
        setIsAnalyzing(false);
      }, 500);
    }
  };

  // Quick Inline Comments Regenerate (when changing density)
  const handleRegenerateCommentsOnly = async () => {
    if (!activeFile) return;
    setIsRegeneratingComments(true);

    try {
      const res = await fetch('/api/docuflow/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: activeFile.content,
          filename: activeFile.filename,
          language: selectedLanguage,
          density: commentDensity,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to regenerate comments.');
      }

      if (analysis) {
        setAnalysis({
          ...analysis,
          density: commentDensity,
          comments: {
            ...analysis.comments,
            commentedCode: data.commentedCode,
            commentarySummary: data.commentarySummary,
            keyInsights: data.keyInsights,
            densityUsed: commentDensity,
          },
        });
      }
    } catch (err: any) {
      console.error('Comments regen error:', err);
    } finally {
      setIsRegeneratingComments(false);
    }
  };

  // Download All as ZIP
  const handleDownloadZip = async () => {
    if (!analysis) return;
    const zip = new JSZip();

    // 1. README.md
    zip.file('README.md', analysis.readmeMarkdown);

    // 2. docs/ folder
    const docs = zip.folder('docs');
    if (docs) {
      docs.file('ARCHITECTURE.md', analysis.architectureMarkdown);
      docs.file('SETUP_GUIDE.md', analysis.setupMarkdown);
      docs.file('diagram.mermaid', analysis.architecture.mermaidDiagram);
    }

    // 3. annotated_code/ folder
    const annotated = zip.folder('annotated_code');
    if (annotated && activeFile) {
      const ext = activeFile.filename.split('.').pop() || 'ts';
      const baseName = activeFile.filename.replace(/\.[^/.]+$/, '');
      annotated.file(`${baseName}.annotated.${ext}`, analysis.comments.commentedCode);
    }

    // 4. original_code/ folder
    const original = zip.folder('original_code');
    if (original) {
      files.forEach((f) => {
        original.file(f.filename, f.content);
      });
    }

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = `docuflow-bundle-${Date.now()}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Split-pane resizing handlers
  const handleMouseDown = () => {
    isResizing.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing.current) return;
    const windowWidth = window.innerWidth;
    const newLeftPercent = Math.max(20, Math.min(80, (e.clientX / windowWidth) * 100));
    setLeftPaneWidth(newLeftPercent);
  };

  const handleMouseUp = () => {
    isResizing.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-neutral-100 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 overflow-hidden select-none font-sans">
      {/* Top Header */}
      <Header
        isDark={isDark}
        onToggleTheme={() => setIsDark(!isDark)}
        selectedLanguage={selectedLanguage}
        onSelectLanguage={setSelectedLanguage}
        density={commentDensity}
        onSelectDensity={setCommentDensity}
        onLoadPreset={handleLoadPreset}
        onDownloadZip={handleDownloadZip}
        analysis={analysis}
        onAnalyze={handleAnalyze}
        isAnalyzing={isAnalyzing}
      />

      {/* Error Banner */}
      {analysisError && (
        <div className="px-4 py-2 bg-rose-500/10 border-b border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{analysisError}</span>
          </div>
          <button
            onClick={() => setAnalysisError(null)}
            className="p-1 hover:bg-rose-500/20 rounded transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Pane Layout Mode Switcher */}
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-neutral-200 dark:border-neutral-850 bg-neutral-50/50 dark:bg-neutral-900/50 text-xs text-neutral-500">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-neutral-700 dark:text-neutral-300">Workspace</span>
          <span>•</span>
          <span className="font-mono text-[11px] text-neutral-400">
            {files.length} file{files.length !== 1 ? 's' : ''} loaded
          </span>
        </div>

        <div className="flex items-center gap-1 bg-neutral-200/50 dark:bg-neutral-800/50 p-0.5 rounded-lg text-xs">
          <button
            onClick={() => setViewMode('editor-only')}
            className={`p-1 rounded-md transition-colors ${
              viewMode === 'editor-only'
                ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
            title="Code Editor Only"
          >
            <PanelLeftClose className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewMode('split')}
            className={`p-1 rounded-md transition-colors ${
              viewMode === 'split'
                ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
            title="Split View (Editor & Docs)"
          >
            <Columns className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewMode('docs-only')}
            className={`p-1 rounded-md transition-colors ${
              viewMode === 'docs-only'
                ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
            title="Documentation Only"
          >
            <PanelLeftOpen className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Split-Pane Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Pane: Code Input & File Manager */}
        {(viewMode === 'split' || viewMode === 'editor-only') && (
          <div
            style={{
              width: viewMode === 'editor-only' ? '100%' : `${leftPaneWidth}%`,
            }}
            className="h-full flex flex-col min-w-[280px]"
          >
            <CodeEditorPane
              files={files}
              activeFileId={activeFileId}
              onSelectFile={setActiveFileId}
              onUpdateFileContent={handleUpdateFileContent}
              onUpdateFileLanguage={handleUpdateFileLanguage}
              onAddFile={handleAddFile}
              onDeleteFile={handleDeleteFile}
              onAnalyze={handleAnalyze}
              isAnalyzing={isAnalyzing}
              onFetchGithub={handleFetchGithub}
              isFetchingGithub={isFetchingGithub}
              githubError={githubError}
            />
          </div>
        )}

        {/* Draggable Divider */}
        {viewMode === 'split' && (
          <div
            onMouseDown={handleMouseDown}
            className="w-1.5 hover:w-2 bg-neutral-200/80 dark:bg-neutral-800/80 hover:bg-indigo-500 dark:hover:bg-indigo-500 cursor-col-resize transition-all duration-150 z-20 flex items-center justify-center group"
          >
            <div className="w-0.5 h-8 rounded-full bg-neutral-400 group-hover:bg-white transition-colors" />
          </div>
        )}

        {/* Right Pane: Generated Documentation */}
        {(viewMode === 'split' || viewMode === 'docs-only') && (
          <div
            style={{
              width: viewMode === 'docs-only' ? '100%' : `${100 - leftPaneWidth}%`,
            }}
            className="h-full flex flex-col min-w-[320px] relative overflow-hidden"
          >
            {isAnalyzing ? (
              <div className="h-full flex items-center justify-center p-6 bg-neutral-50/50 dark:bg-neutral-950/50 overflow-auto">
                <ProgressIndicator progress={progress} />
              </div>
            ) : (
              <DocumentationPane
                analysis={analysis}
                activeFile={activeFile}
                isDark={isDark}
                onDensityChange={setCommentDensity}
                isRegeneratingComments={isRegeneratingComments}
                onRegenerateCommentsOnly={handleRegenerateCommentsOnly}
                onDownloadZip={handleDownloadZip}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
export default App;
