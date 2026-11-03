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
  onRouteStateChange,
  isLoading
}) => {
  const [showMissingDrawer, setShowMissingDrawer] = React.useState(false);
  const model = useDataBankModel({ warnings, archivedWarnings, initialStatusFilter, initialNavAreaFilter, routeState, onRouteStateChange });

  return (
    <div data-databank-v2 className="flex flex-col gap-6 font-sans p-4 w-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2.5">
          <h1 className="view-title">Data bank</h1>
          <span className="text-sm font-normal text-[var(--ink-secondary,#5f6b7a)]">
            {isLoading && warnings.length === 0 ? 'Syncing live warnings...' : (
              <>
                <span className="font-medium text-[var(--ink-primary,#0b0e11)]">{warnings.length}</span> published warnings
              </>
            )}
          </span>
        </div>
      </div>

      <div className="border border-[var(--hairline,#eef1f4)] rounded-[8px] overflow-hidden bg-transparent">
        <DataBankStatusBar
          model={model}
          sources={sources}
          onTriggerRefresh={onTriggerRefresh}
          isRefreshing={isRefreshing}
          isLoading={isLoading}
        />
        <div className="border-t border-[var(--hairline-alt,#f2f5f8)]">
          <DataBankControls model={model} />
        </div>
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

      <DataBankWarningList model={model} onLocate={onLocate} onVerifyWarning={onVerifyWarning} sources={sources} isLoading={isLoading} />

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


