'use client';
import React, { useRef, useEffect } from 'react';
import { useAuditSystem } from '@/hooks/useAuditSystem';
import { Header } from '@/components/layout/Header';
import { Toolbar } from '@/components/features/Toolbar';
import { ScheduleTable } from '@/components/features/ScheduleTable';
import { TrainingTable } from '@/components/features/TrainingTable';
import { MobileView } from '@/components/features/MobileView';
import { LoginForm } from '@/components/auth/LoginForm';
import { EnterpriseModal } from '@/components/modals/EnterpriseModal';
import { ReportModal } from '@/components/modals/ReportModal';
import { SetTypeModal } from '@/components/modals/SetTypeModal';

export default function AuditSystem() {
  const {
    isAuthenticated, password, setPassword, loginError, handleLogin, logout,
    enterprises, filteredEnterprises, fiscalYear, focusMonth, setFocusMonth, realMonth, realFiscalYear,
    modalMode, setModalMode, targetEnt, setTargetEnt, selectedCell, 
    tempReport, setTempReport,
    isSyncing, refreshFromCloud,
    searchTerm, setSearchTerm, filterMode, setFilterMode, viewMode, setViewMode,
    sortColumn, sortDirection, handleSort,
    changeFiscalYear, handleSaveEnterprise, handleDeleteEnterprise, handleSaveReport,
    handleSetType, handleRemoveSchedule, openChecklist
  } = useAuditSystem();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scrollRef = useRef<any>(null);

  // --- Search Scroll Effect ---
  useEffect(() => {
    if (searchTerm && scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [searchTerm]);

  if (!isAuthenticated) {
    return <LoginForm password={password} setPassword={setPassword} loginError={loginError} handleLogin={handleLogin} />;
  }

  return (
    <main className="container" style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#f8fafc', padding: '0.6rem' }}>
      <header style={{ flex: '0 0 auto', marginBottom: '0.6rem' }}>
        <Header 
          isSyncing={isSyncing} 
          onAddEnterprise={() => { 
            setTargetEnt({ id: '', name: '', countTokutei: 0, countJisshu23: 0, countJisshu1: 0, entryDateJisshu1: '', acceptTypes: [], schedule: [] }); 
            setModalMode('add'); 
          }}
          logout={logout}
        />
        <Toolbar 
          searchTerm={searchTerm} setSearchTerm={setSearchTerm}
          filterMode={filterMode} setFilterMode={setFilterMode}
          viewMode={viewMode} setViewMode={setViewMode}
          fiscalYear={fiscalYear} changeFiscalYear={changeFiscalYear}
          filteredCount={filteredEnterprises.length} totalCount={enterprises.length}
          isSyncing={isSyncing} onRefresh={refreshFromCloud}
        />
      </header>

      {viewMode === 'schedule' ? (
        <>
          <ScheduleTable 
            filteredEnterprises={filteredEnterprises}
            searchTerm={searchTerm}
            focusMonth={focusMonth}
            realMonth={realMonth}
            realFiscalYear={realFiscalYear}
            fiscalYear={fiscalYear}
            onEditEnterprise={(ent) => { setTargetEnt(ent); setModalMode('edit'); }}
            openChecklist={openChecklist}
            scrollRef={scrollRef}
            onMonthClick={(m) => {
              if (focusMonth === m && filterMode === 'month') {
                setFilterMode('all');
              } else {
                setFocusMonth(m);
                setFilterMode('month');
              }
            }}
            filterMode={filterMode}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            onSort={handleSort}
          />
          <MobileView 
            filteredEnterprises={filteredEnterprises}
            searchTerm={searchTerm}
            realMonth={realMonth}
            realFiscalYear={realFiscalYear}
            fiscalYear={fiscalYear}
            onEditEnterprise={(ent) => { setTargetEnt(ent); setModalMode('edit'); }}
            openChecklist={openChecklist}
            scrollRef={scrollRef}
          />
        </>
      ) : (
        <TrainingTable 
          filteredEnterprises={filteredEnterprises}
          searchTerm={searchTerm}
          onEditEnterprise={(ent) => { setTargetEnt(ent); setModalMode('edit'); }}
          scrollRef={scrollRef}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={handleSort}
        />
      )}

      {/* Modals */}
      {(modalMode === 'add' || modalMode === 'edit') && (
        <EnterpriseModal 
          modalMode={modalMode} targetEnt={targetEnt} setTargetEnt={setTargetEnt}
          onClose={() => setModalMode('none')} onSave={handleSaveEnterprise} onDelete={handleDeleteEnterprise}
        />
      )}

      {modalMode === 'checklist' && selectedCell && (
        <ReportModal 
          selectedCell={selectedCell} enterprises={enterprises}
          tempReport={tempReport} setTempReport={setTempReport}
          onClose={() => setModalMode('none')} onSave={handleSaveReport} onRemove={handleRemoveSchedule}
        />
      )}

      {modalMode === 'settype' && selectedCell && (
        <SetTypeModal 
          month={selectedCell.month} onSetType={handleSetType} onClose={() => setModalMode('none')}
        />
      )}
    </main>
  );
}
