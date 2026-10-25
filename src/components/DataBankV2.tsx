import React from 'react';
import { DataBankWarningList } from './DataBankWarningList';
import { DataBankStatusBar } from './DataBankStatusBar';
import { DataBankControls } from './DataBankControls';
import { DataBankSummary } from './DataBankSummary';
import { IngestionProcedureModal } from './IngestionProcedureModal';
import { InForceCoverageBanner } from './InForceCoverageBanner';
import { MissingWarningsDrawer } from './MissingWarningsDrawer';
import { useDataBankModel, type DataBankProps } from '../hooks/useDataBankModel';

/**
 * v2 Data Bank hierarchy: one status bar + control block, then the warning
 * list as the dominant content, then the collapsed Summary. Same model and
 * same list markup as the classic path — only the structure changes.
 */
export const DataBankV2: React.FC<DataBankProps> = ({
  warnings,
  archivedWarnings,
  onLocate,
  onVerifyWarning,
  onTriggerRefresh,
  isRefreshing = false,
  onCommitWarnings,
  sources = [],
  generations,
  initialStatusFilter,
  initialNavAreaFilter,
  routeState,
  onRouteStateChange
}) => {
  const [showMissingDrawer, setShowMissingDrawer] = React.useState(false);
  const model = useDataBankModel({ warnings, archivedWarnings, initialStatusFilter, initialNavAreaFilter, routeState, onRouteStateChange });

  return (
    <div data-databank-v2 className="flex flex-col gap-3 font-ui max-w-[1600px] mx-auto p-3 sm:p-4 md:p-6 w-full">
      {/* Page Header matching index.html */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2.5">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Data Bank</h1>
          <span className="text-xs sm:text-sm font-medium text-slate-500">
            {warnings.length} published warnings
          </span>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <DataBankStatusBar
          model={model}
          sources={sources}
          onTriggerRefresh={onTriggerRefresh}
          isRefreshing={isRefreshing}
        />
        <DataBankControls model={model} />
      </div>

      {/* In-Force Coverage Banner when NAVAREA is selected */}
      {model.selectedNavArea !== 'ALL' && model.inForceStatus && (
        <InForceCoverageBanner
          status={model.inForceStatus}
          navarea={model.selectedNavArea}
          onViewMissing={() => setShowMissingDrawer(true)}
          onTriggerRefresh={onTriggerRefresh}
          isRefreshing={isRefreshing}
        />
      )}

      <DataBankWarningList model={model} onLocate={onLocate} onVerifyWarning={onVerifyWarning} sources={sources} />

      <DataBankSummary model={model} sources={sources} generations={generations} />

      <MissingWarningsDrawer
        isOpen={showMissingDrawer}
        onClose={() => setShowMissingDrawer(false)}
        navarea={model.selectedNavArea}
        missingIds={model.inForceStatus?.missingWarningIds || []}
        onFetchMissing={onTriggerRefresh ? () => onTriggerRefresh() : undefined}
        isFetching={isRefreshing}
      />

      <IngestionProcedureModal
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


