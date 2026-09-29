import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  FileText,
  User,
  CheckCircle,
  XCircle,
  Clock,
  Layers,
  Terminal,
  RefreshCw,
  Search,
  ExternalLink,
  ChevronRight,
  Database,
  Eye,
  FileCode,
  Info
} from 'lucide-react';

interface CaseSummary {
  case_id: string;
  scenario: string;
  document_ids: string[];
  submitted_name?: string;
  submitted_dob?: string;
  submitted_address?: string;
}

interface DocumentResult {
  document_id: string;
  document_type: string | null;
  decision: 'APPROVE' | 'REVIEW' | 'REJECT';
  reason_codes: string[];
  parsed_fields: Record<string, string>;
  completeness: number;
  warnings: string[];
  source: string;
}

interface CaseResult {
  case_id: string;
  decision: 'APPROVE' | 'REVIEW' | 'REJECT';
  reason_codes: string[];
  documents: DocumentResult[];
  limitation_notice: string;
}

interface DocumentDetail {
  document_id: string;
  sidecar: string;
  ground_truth?: {
    document_id: string;
    document_type: string;
    full_name: string;
    date_of_birth: string;
    document_number: string;
    issue_date: string;
    expiry_date: string;
    address?: string;
    nationality?: string;
    scenario_flags: string[];
  };
  image_url: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'workbench' | 'inspector' | 'api' | 'matrix'>('workbench');
  const [healthStatus, setHealthStatus] = useState<{ live: boolean; ready: boolean; casesCount: number }>({
    live: false,
    ready: false,
    casesCount: 0,
  });

  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('CASE-001');
  const [selectedDocId, setSelectedDocId] = useState<string>('CASE-001-PASSPORT');
  
  // Verification states
  const [caseVerifying, setCaseVerifying] = useState(false);
  const [caseResult, setCaseResult] = useState<CaseResult | null>(null);
  const [docVerifying, setDocVerifying] = useState(false);
  const [docResult, setDocResult] = useState<DocumentResult | null>(null);

  // Inspector detail
  const [docDetail, setDocDetail] = useState<DocumentDetail | null>(null);
  const [loadingDocDetail, setLoadingDocDetail] = useState(false);

  // API sandbox states
  const [apiEndpoint, setApiEndpoint] = useState<string>('/v1/cases');
  const [apiMethod, setApiMethod] = useState<'GET' | 'POST'>('GET');
  const [apiRequestBody, setApiRequestBody] = useState<string>('{\n  "document_id": "CASE-001-PASSPORT"\n}');
  const [apiResponse, setApiResponse] = useState<{ status: number; headers: Record<string, string>; data: any } | null>(null);
  const [apiLoading, setApiLoading] = useState(false);

  // Fetch initial health and cases
  useEffect(() => {
    checkHealth();
    fetchCases();
  }, []);

  const checkHealth = async () => {
    try {
      const [liveRes, readyRes] = await Promise.all([
        fetch('/health/live'),
        fetch('/health/ready'),
      ]);
      const liveData = await liveRes.json();
      const readyData = await readyRes.json();
      setHealthStatus({
        live: liveData.status === 'ok',
        ready: readyData.status === 'ready',
        casesCount: readyData.dataset_cases || 0,
      });
    } catch {
      setHealthStatus({ live: false, ready: false, casesCount: 0 });
    }
  };

  const fetchCases = async () => {
    try {
      const res = await fetch('/api/cases');
      if (res.ok) {
        const data = await res.json();
        setCases(data);
      } else {
        const fallback = await fetch('/v1/cases');
        const data = await fallback.json();
        setCases(data);
      }
    } catch (err) {
      console.error('Failed to fetch cases:', err);
    }
  };

  // When selected case changes, trigger verification
  useEffect(() => {
    if (!selectedCaseId) return;
    runCaseVerify(selectedCaseId);
  }, [selectedCaseId]);

  // When selected document changes, load detail and verify
  useEffect(() => {
    if (!selectedDocId) return;
    loadDocument(selectedDocId);
    runDocVerify(selectedDocId);
  }, [selectedDocId]);

  const runCaseVerify = async (caseId: string) => {
    setCaseVerifying(true);
    try {
      const res = await fetch(`/v1/cases/${caseId}/verify`, {
        method: 'POST',
      });
      const data = await res.json();
      setCaseResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setCaseVerifying(false);
    }
  };

  const runDocVerify = async (docId: string) => {
    setDocVerifying(true);
    try {
      const res = await fetch('/v1/documents/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_id: docId }),
      });
      const data = await res.json();
      setDocResult(data);
    } catch (err) {
      console.error(err);
    } finally {
      setDocVerifying(false);
    }
  };

  const loadDocument = async (docId: string) => {
    setLoadingDocDetail(true);
    try {
      const res = await fetch(`/api/documents/${docId}`);
      if (res.ok) {
        const data = await res.json();
        setDocDetail(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDocDetail(false);
    }
  };

  const executeApiCall = async () => {
    setApiLoading(true);
    try {
      const options: RequestInit = {
        method: apiMethod,
        headers: {
          'x-correlation-id': `kyc-test-${Date.now()}`,
          ...(apiMethod === 'POST' ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(apiMethod === 'POST' ? { body: apiRequestBody } : {}),
      };
      const res = await fetch(apiEndpoint, options);
      const data = await res.json().catch(() => ({}));
      const headersObj: Record<string, string> = {};
      res.headers.forEach((val, key) => {
        headersObj[key] = val;
      });
      setApiResponse({
        status: res.status,
        headers: headersObj,
        data,
      });
    } catch (err: any) {
      setApiResponse({
        status: 0,
        headers: {},
        data: { error: err.message },
      });
    } finally {
      setApiLoading(false);
    }
  };

  const selectedCase = cases.find(c => c.case_id === selectedCaseId);

  const getDecisionBadge = (decision?: string) => {
    switch (decision) {
      case 'APPROVE':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            APPROVE
          </span>
        );
      case 'REVIEW':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            REVIEW
          </span>
        );
      case 'REJECT':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            REJECT
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
            PENDING
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow">
                KYC
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-bold tracking-tight">AI FDE Brownfield KYC Service</h1>
                  <span className="bg-blue-900/60 text-blue-300 border border-blue-700/50 text-[10px] font-mono px-2 py-0.5 rounded">
                    v1.0.0
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Synthetic Identity-Document Verification & Deterministic OCR Engine
                </p>
              </div>
            </div>

            {/* System Status Indicators */}
            <div className="flex items-center space-x-2 text-xs">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700">
                <div className={`w-2 h-2 rounded-full ${healthStatus.live ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                <span className="text-slate-300 font-medium">Live</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700">
                <Database className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-slate-300 font-medium">{healthStatus.casesCount} Cases</span>
              </div>
              <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-slate-300 font-mono text-[11px]">2026-09-09</span>
              </div>
            </div>
          </div>

          {/* Navigation Bar */}
          <nav className="flex space-x-1 border-t border-slate-800/80 pt-1 -mb-px">
            <button
              onClick={() => setActiveTab('workbench')}
              className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'workbench'
                  ? 'border-blue-500 text-blue-400 bg-slate-800/50'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Case Verification Workbench
            </button>
            <button
              onClick={() => setActiveTab('inspector')}
              className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'inspector'
                  ? 'border-blue-500 text-blue-400 bg-slate-800/50'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Document OCR Inspector
            </button>
            <button
              onClick={() => setActiveTab('api')}
              className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'api'
                  ? 'border-blue-500 text-blue-400 bg-slate-800/50'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              Interactive API Sandbox
            </button>
            <button
              onClick={() => setActiveTab('matrix')}
              className={`px-4 py-2.5 text-xs font-semibold rounded-t-lg border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'matrix'
                  ? 'border-blue-500 text-blue-400 bg-slate-800/50'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" />
              Scenario Catalog & Rules
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex-1">
        {/* TAB 1: WORKBENCH */}
        {activeTab === 'workbench' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Case Selector Column */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-600" />
                    Applicant Cases
                  </h2>
                  <span className="text-xs text-slate-500">{cases.length} cases</span>
                </div>
                <div className="space-y-2">
                  {cases.map(item => {
                    const isSelected = item.case_id === selectedCaseId;
                    return (
                      <button
                        key={item.case_id}
                        onClick={() => setSelectedCaseId(item.case_id)}
                        className={`w-full text-left p-3 rounded-lg border transition-all ${
                          isSelected
                            ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-500/20 shadow-xs'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono text-xs font-bold text-slate-900">{item.case_id}</span>
                          <span className="text-[11px] font-medium text-slate-500">
                            {item.document_ids.length} docs
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 font-medium line-clamp-1">{item.scenario}</p>
                        {item.submitted_name && (
                          <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1">
                            <span>Applicant:</span>
                            <span className="text-slate-700 font-semibold">{item.submitted_name}</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Service Context Notice */}
              <div className="bg-slate-900 text-slate-300 rounded-xl p-4 text-xs space-y-2 border border-slate-800">
                <div className="flex items-center gap-2 text-amber-400 font-semibold">
                  <Info className="w-4 h-4" />
                  <span>Legacy Model Aggregator</span>
                </div>
                <p className="text-slate-400 leading-relaxed">
                  Repo 1.0 evaluates documents independently using baseline regex and completeness rules, then calculates
                  case outcome via worst-case rank (<span className="text-slate-200 font-mono">APPROVE &lt; REVIEW &lt; REJECT</span>).
                </p>
              </div>
            </div>

            {/* Right Case Verification Details Column */}
            <div className="lg:col-span-8 space-y-6">
              {selectedCase && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 bg-slate-50/50">
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="text-lg font-bold text-slate-900">{selectedCase.case_id}</h2>
                        {caseResult && getDecisionBadge(caseResult.decision)}
                      </div>
                      <p className="text-xs text-slate-600 mt-1">{selectedCase.scenario}</p>
                    </div>

                    <button
                      onClick={() => runCaseVerify(selectedCase.case_id)}
                      disabled={caseVerifying}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs disabled:opacity-60 transition"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${caseVerifying ? 'animate-spin' : ''}`} />
                      Run Full Verification
                    </button>
                  </div>

                  {/* Case Verification Overview Banner */}
                  {caseResult && (
                    <div className="p-5 space-y-5">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
                            Aggregated Decision
                          </span>
                          <div className="mt-1">{getDecisionBadge(caseResult.decision)}</div>
                        </div>

                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
                            Reason Codes
                          </span>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {caseResult.reason_codes.map((r, i) => (
                              <span
                                key={i}
                                className={`text-[10px] font-mono px-2 py-0.5 rounded font-medium ${
                                  r === 'BASELINE_RULES_PASSED'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : r.includes('EXPIRED') || r.includes('TAMPERING')
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}
                              >
                                {r}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
                            Documents Evaluated
                          </span>
                          <span className="text-base font-bold text-slate-800 mt-1 block">
                            {caseResult.documents.length} Synthetic Documents
                          </span>
                        </div>
                      </div>

                      {caseResult.limitation_notice && (
                        <div className="p-3 rounded-lg bg-amber-50/80 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold block">Architectural Boundary Notice:</span>
                            {caseResult.limitation_notice}
                          </div>
                        </div>
                      )}

                      {/* Documents breakdown table */}
                      <div>
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
                          Document Verifications Breakdown
                        </h3>
                        <div className="space-y-3">
                          {caseResult.documents.map((doc, idx) => (
                            <div
                              key={idx}
                              className="border border-slate-200 rounded-lg p-4 bg-white hover:border-slate-300 transition"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                                <div className="flex items-center gap-2">
                                  <FileText className="w-4 h-4 text-blue-600" />
                                  <span className="font-mono text-xs font-bold text-slate-900">{doc.document_id}</span>
                                  <span className="text-xs text-slate-500 font-mono">
                                    ({doc.document_type || 'UNKNOWN'})
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {getDecisionBadge(doc.decision)}
                                  <button
                                    onClick={() => {
                                      setSelectedDocId(doc.document_id);
                                      setActiveTab('inspector');
                                    }}
                                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium ml-2"
                                  >
                                    Inspect OCR <ChevronRight className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs mt-3 bg-slate-50 p-3 rounded-md">
                                <div>
                                  <span className="font-semibold text-slate-700 block mb-1">Parsed Fields:</span>
                                  <dl className="grid grid-cols-2 gap-x-2 gap-y-1">
                                    {Object.entries(doc.parsed_fields).map(([k, v]) => (
                                      <React.Fragment key={k}>
                                        <dt className="text-slate-500 capitalize">{k.replace('_', ' ')}:</dt>
                                        <dd className="font-mono text-slate-800 truncate" title={v}>
                                          {v}
                                        </dd>
                                      </React.Fragment>
                                    ))}
                                  </dl>
                                </div>

                                <div className="space-y-2">
                                  <div>
                                    <span className="font-semibold text-slate-700 block mb-1">
                                      Completeness: {Math.round(doc.completeness * 100)}%
                                    </span>
                                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                      <div
                                        className={`h-full ${
                                          doc.completeness >= 0.75 ? 'bg-emerald-500' : 'bg-rose-500'
                                        }`}
                                        style={{ width: `${doc.completeness * 100}%` }}
                                      />
                                    </div>
                                  </div>

                                  {doc.warnings.length > 0 && (
                                    <div>
                                      <span className="font-semibold text-amber-700 block">Warnings:</span>
                                      <ul className="list-disc list-inside text-amber-800 font-mono text-[11px] space-y-0.5">
                                        {doc.warnings.map((w, wi) => (
                                          <li key={wi}>{w}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: DOCUMENT OCR INSPECTOR */}
        {activeTab === 'inspector' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Document Selector Sidebar */}
            <div className="lg:col-span-3 space-y-3">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <h2 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  Select Document
                </h2>
                <div className="space-y-1.5 max-h-[70vh] overflow-y-auto pr-1">
                  {cases.flatMap(c => c.document_ids).map(docId => (
                    <button
                      key={docId}
                      onClick={() => setSelectedDocId(docId)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-mono font-medium transition flex items-center justify-between ${
                        selectedDocId === docId
                          ? 'bg-blue-600 text-white font-bold'
                          : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span className="truncate">{docId}</span>
                      <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-70" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Document Inspection Panel */}
            <div className="lg:col-span-9 space-y-6">
              {docResult && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="text-base font-bold font-mono text-slate-900">{selectedDocId}</h2>
                        {getDecisionBadge(docResult.decision)}
                      </div>
                      <span className="text-xs text-slate-500">Source: {docResult.source}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => runDocVerify(selectedDocId)}
                        disabled={docVerifying}
                        className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold rounded-lg text-xs flex items-center gap-1.5 transition"
                      >
                        <RefreshCw className={`w-3 h-3 ${docVerifying ? 'animate-spin' : ''}`} />
                        Re-evaluate Document
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-5">
                    {/* Raw OCR Sidecar */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <Terminal className="w-3.5 h-3.5 text-blue-600" />
                          Sidecar OCR Text (<span className="font-mono">data/sidecar_ocr</span>)
                        </span>
                        <span className="text-[10px] text-slate-400">Deterministic</span>
                      </div>
                      <pre className="bg-slate-900 text-slate-200 p-4 rounded-lg font-mono text-xs h-72 overflow-y-auto whitespace-pre-wrap leading-relaxed border border-slate-800">
                        {docDetail?.sidecar || 'Loading OCR sidecar...'}
                      </pre>
                    </div>

                    {/* Parsed Fields & Analysis */}
                    <div className="space-y-4">
                      <div>
                        <span className="text-xs font-bold text-slate-900 block mb-2">Parsed Key-Value Fields</span>
                        <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
                          <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                              <tr>
                                <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-600">Key</th>
                                <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-600">Parsed Value</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 bg-white">
                              {Object.entries(docResult.parsed_fields).map(([k, v]) => (
                                <tr key={k}>
                                  <td className="px-3 py-1.5 font-mono text-slate-500">{k}</td>
                                  <td className="px-3 py-1.5 font-mono font-medium text-slate-900">{v}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Warnings and Rule Reasons */}
                      <div className="space-y-2">
                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                          <span className="font-semibold text-slate-700 block mb-1">Reason Codes</span>
                          <div className="flex flex-wrap gap-1">
                            {docResult.reason_codes.map((r, i) => (
                              <span key={i} className="px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-mono text-[10px]">
                                {r}
                              </span>
                            ))}
                          </div>
                        </div>

                        {docResult.warnings.length > 0 && (
                          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs">
                            <span className="font-semibold text-amber-800 block mb-1">Warnings Triggered</span>
                            <ul className="list-disc list-inside text-amber-900 font-mono text-[11px]">
                              {docResult.warnings.map((w, i) => (
                                <li key={i}>{w}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Ground Truth Comparison */}
                  {docDetail?.ground_truth && (
                    <div className="mt-6 pt-5 border-t border-slate-200">
                      <div className="flex items-center gap-2 mb-3">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                          Ground Truth Comparison (<span className="font-mono">data/ground_truth</span>)
                        </h3>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50 p-4 rounded-lg border border-slate-200 font-mono">
                        <div>
                          <span className="text-slate-400 block text-[10px]">FULL NAME</span>
                          <span className="text-slate-800 font-bold">{docDetail.ground_truth.full_name}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">DOB</span>
                          <span className="text-slate-800">{docDetail.ground_truth.date_of_birth}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">DOC NUMBER</span>
                          <span className="text-slate-800 font-bold">{docDetail.ground_truth.document_number}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">EXPIRY</span>
                          <span className="text-slate-800">{docDetail.ground_truth.expiry_date}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: INTERACTIVE API SANDBOX */}
        {activeTab === 'api' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Request Builder */}
            <div className="lg:col-span-6 space-y-4">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-blue-600" />
                  API Request Builder
                </h2>

                <div className="space-y-4 text-xs">
                  {/* Presets */}
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Preset Requests</label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          setApiMethod('GET');
                          setApiEndpoint('/v1/cases');
                          setApiRequestBody('');
                        }}
                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono"
                      >
                        GET /v1/cases
                      </button>
                      <button
                        onClick={() => {
                          setApiMethod('POST');
                          setApiEndpoint('/v1/documents/verify');
                          setApiRequestBody('{\n  "document_id": "CASE-001-PASSPORT"\n}');
                        }}
                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono"
                      >
                        POST /v1/documents/verify
                      </button>
                      <button
                        onClick={() => {
                          setApiMethod('POST');
                          setApiEndpoint('/v1/cases/CASE-004/verify');
                          setApiRequestBody('');
                        }}
                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono"
                      >
                        POST /v1/cases/CASE-004/verify
                      </button>
                      <button
                        onClick={() => {
                          setApiMethod('GET');
                          setApiEndpoint('/health/ready');
                          setApiRequestBody('');
                        }}
                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono"
                      >
                        GET /health/ready
                      </button>
                      <button
                        onClick={() => {
                          setApiMethod('POST');
                          setApiEndpoint('/v1/documents/verify');
                          setApiRequestBody('{\n  "document_id": "../secret"\n}');
                        }}
                        className="px-2.5 py-1 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 font-mono"
                      >
                        Test Traversal Block (400)
                      </button>
                    </div>
                  </div>

                  {/* Method & URL */}
                  <div className="flex gap-2">
                    <select
                      value={apiMethod}
                      onChange={e => setApiMethod(e.target.value as any)}
                      className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-800"
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                    </select>
                    <input
                      type="text"
                      value={apiEndpoint}
                      onChange={e => setApiEndpoint(e.target.value)}
                      className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg font-mono text-slate-800"
                      placeholder="/v1/documents/verify"
                    />
                  </div>

                  {/* Body (for POST) */}
                  {apiMethod === 'POST' && (
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">Request JSON Body</label>
                      <textarea
                        value={apiRequestBody}
                        onChange={e => setApiRequestBody(e.target.value)}
                        rows={6}
                        className="w-full font-mono text-xs p-3 bg-slate-900 text-slate-100 rounded-lg border border-slate-700"
                      />
                    </div>
                  )}

                  <button
                    onClick={executeApiCall}
                    disabled={apiLoading}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-xs flex items-center justify-center gap-2 transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${apiLoading ? 'animate-spin' : ''}`} />
                    Send Request
                  </button>
                </div>
              </div>
            </div>

            {/* Response Viewer */}
            <div className="lg:col-span-6 space-y-4">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-emerald-600" />
                    Response
                  </h2>
                  {apiResponse && (
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold ${
                          apiResponse.status >= 200 && apiResponse.status < 300
                            ? 'bg-emerald-100 text-emerald-800'
                            : apiResponse.status === 400 || apiResponse.status === 422
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        Status: {apiResponse.status}
                      </span>
                    </div>
                  )}
                </div>

                {apiResponse ? (
                  <div className="space-y-3">
                    {apiResponse.headers['x-correlation-id'] && (
                      <div className="text-[11px] font-mono text-slate-500 bg-slate-50 p-2 rounded border border-slate-200">
                        x-correlation-id: {apiResponse.headers['x-correlation-id']}
                      </div>
                    )}
                    <pre className="p-4 bg-slate-900 text-emerald-400 rounded-lg font-mono text-xs overflow-auto max-h-[500px] leading-relaxed border border-slate-800">
                      {JSON.stringify(apiResponse.data, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <div className="p-12 text-center text-slate-400 text-xs">
                    Execute a request above to view formatted response payload.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: SCENARIO CATALOG & RULES */}
        {activeTab === 'matrix' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900">Synthetic Scenario Matrix (Brownfield KYC 1.0)</h2>
              <p className="text-xs text-slate-500 mt-1">
                The 6 benchmark applicant scenarios included in this repository to test baseline rule behavior.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Case ID</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Scenario Description</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Included Documents</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Expected Outcome</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Triggered Rules</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-sans">
                  <tr>
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">CASE-001</td>
                    <td className="px-4 py-3 text-slate-700">Clean passport, national-ID and driving licence</td>
                    <td className="px-4 py-3 font-mono text-slate-500">PASSPORT, NID, DL</td>
                    <td className="px-4 py-3">{getDecisionBadge('APPROVE')}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">BASELINE_RULES_PASSED</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">CASE-002</td>
                    <td className="px-4 py-3 text-slate-700">Noisy / degraded scan with unreadable glyphs</td>
                    <td className="px-4 py-3 font-mono text-slate-500">PASSPORT, NID</td>
                    <td className="px-4 py-3">{getDecisionBadge('REVIEW')}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">OCR_QUALITY_DEGRADED</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">CASE-003</td>
                    <td className="px-4 py-3 text-slate-700">Rotated document capture (90 degrees)</td>
                    <td className="px-4 py-3 font-mono text-slate-500">PASSPORT, DL</td>
                    <td className="px-4 py-3">{getDecisionBadge('REVIEW')}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">ROTATED_DOCUMENT</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">CASE-004</td>
                    <td className="px-4 py-3 text-slate-700">Expired passport vs frozen reference date (2026-09-09)</td>
                    <td className="px-4 py-3 font-mono text-slate-500">PASSPORT, NID</td>
                    <td className="px-4 py-3">{getDecisionBadge('REJECT')}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">DOCUMENT_EXPIRED</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">CASE-005</td>
                    <td className="px-4 py-3 text-slate-700">Name variation + deliberate OCR corruption</td>
                    <td className="px-4 py-3 font-mono text-slate-500">PASSPORT, NID</td>
                    <td className="px-4 py-3">{getDecisionBadge('APPROVE')}</td>
                    <td className="px-4 py-3 text-amber-700 font-medium">
                      ⚠️ Limitation: Brownfield does not do cross-doc match
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">CASE-006</td>
                    <td className="px-4 py-3 text-slate-700">Suspected tampering indicator detected in text region</td>
                    <td className="px-4 py-3 font-mono text-slate-500">PASSPORT, DL</td>
                    <td className="px-4 py-3">{getDecisionBadge('REJECT')}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">SUSPECTED_TAMPERING</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 px-6 text-xs text-slate-500 text-center">
        AI FDE Brownfield KYC Service 1.0 • Offline OCR Mode • Port 3000 • Express & Vite Architecture
      </footer>
    </div>
  );
}
