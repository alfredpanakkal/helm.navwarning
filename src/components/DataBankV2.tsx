import React from 'react';
import { DataBankWarningList } from './DataBankWarningList';
import { DataBankStatusBar } from './DataBankStatusBar';
import { DataBankControls } from './DataBankControls';
import { DataBankSummary } from './DataBankSummary';
import { IngestionProcedureModalV2 } from './IngestionProcedureModalV2';
import { useDataBankModel, type DataBankProps } from '../hooks/useDataBankModel';

/**
 * v2 Data Bank hierarchy: one status bar + control block, then the warning
 * list as the dominant content, then the collapsed Summary. Same model and
 * same list markup as the classic path — only the structure changes.
 */
export const DataBankV2: React.FC<DataBankProps> = ({
  warnings,
  onLocate,
  onVerifyWarning,
  onTriggerRefresh,
  isRefreshing = false,
  onCommitWarnings,
  sources = [],
  initialStatusFilter,
  initialNavAreaFilter
}) => {
  const model = useDataBankModel({ warnings, initialStatusFilter, initialNavAreaFilter });

  return (
    <div data-databank-v2 className="flex flex-col gap-3 font-ui">
      <div className="bg-secondary border-subtle rounded-md overflow-hidden">
        <DataBankStatusBar
          model={model}
          sources={sources}
          onTriggerRefresh={onTriggerRefresh}
          isRefreshing={isRefreshing}
        />
        <DataBankControls model={model} />
      </div>

      <DataBankWarningList model={model} onLocate={onLocate} onVerifyWarning={onVerifyWarning} sources={sources} />

      <DataBankSummary model={model} sources={sources} />

      <IngestionProcedureModalV2
        isOpen={model.isProcedureModalOpen}
        onClose={() => model.setIsProcedureModalOpen(false)}
        warningsCount={warnings.length}
        sources={sources}
        onTriggerRefresh={onTriggerRefresh}
        isRefreshing={isRefreshing}
        onCommitWarning={(newWarn) => {
          if (onCommitWarnings) {
            onCommitWarnings([newWarn]);
          }
        }}
      />
    </div>
  );
};

