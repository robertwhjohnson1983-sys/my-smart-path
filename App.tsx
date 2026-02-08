import React, { useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { RecruiterAnalysis } from './types';

// PDF and Word parsing support via esm.sh
const PDFJS_URL = 'https://esm.sh/pdfjs-dist@4.10.38';
const PDFJS_WORKER_URL = 'https://esm.sh/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
const MAMMOTH_URL = 'https://esm.sh/mammoth@1.8.0';

const App: React.FC = () => {
  const [resume, setResume] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [parsingFile, setParsingFile] = useState(false);
  const [result, setResult] = useState<RecruiterAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const extractTextFromPDF = async (file: File): Promise<string> => {
    try {
      // @ts-ignore
      const pdfjsLib = await import(PDFJS_URL);
      pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n';
      }
      return fullText;
    } catch (err) {
      throw new Error('Failed to parse PDF.');
    }
  };

  const extractTextFromWord = async (file: File): Promise<string> => {
    try {
      // @ts-ignore
      const mammoth = await import(MAMMOTH_URL);
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value;
    } catch (err) {
      throw new Error('Failed to parse Word document.');
    }
  };

  const handleFileRead = async (file: File) => {
    setError(null);
    setParsingFile(true);
    const fileName = file.name.toLowerCase();
    try {
      if (fileName.endsWith('.pdf')) {
        setResume(await extractTextFromPDF(file));
      } else if (fileName.endsWith('.docx')) {
        setResume(await extractTextFromWord(file));
      } else if (fileName.endsWith('.txt') || fileName.endsWith('.md')) {
        const reader = new FileReader();
        reader.onload = (e) => setResume(e.target?.result as string);
        reader.readAsText(file);
      } else {
        throw new Error('Unsupported file type.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setParsingFile(false);
    }
  };

  const handleGoogleDriveClick = () => {
    alert("Google Drive integration requires a Google Cloud Project Client ID and the Google Picker API enabled.");
  };

  const analyzeMatch = async () => {
    if (!resume.trim()) {
      setError('A resume is required for analysis.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
// 1. Initialize Google AI
const genAI = new GoogleGenerativeAI("AIzaSyAZlGZd9KaDy9bJf0Sv1gnOGlasj6lNXY8");

// 2. FORCE the stable version 'v1' here
const model = genAI.getGenerativeModel(
  { model: "gemini-1.5-pro" }, 
  { apiVersion: "v1" } 
);
      
     const prompt = `
  ROLE: Senior Talent Acquisition Specialist & Executive Resume Writer.
  TASK: Perform a high-fidelity audit of this Resume against the Job Description.
  
  RESUME: ${resume}
  JOB DESCRIPTION: ${jobDescription || "None (Provide a general career strength audit if JD is missing)"}
  
  INSTRUCTIONS:
  1. ATS AUDIT: Identify "parsability" issues (columns, tables, headers).
  2. ALIGNMENT: Don't just match keywords; look for "Outcome-Based" evidence. If they mention a skill, is there a metric attached?
  3. TRANSFERABLE SKILLS: Map specific achievements to the new role's requirements.
  
  OUTPUT: Return ONLY valid JSON matching the RecruiterAnalysis structure.
`;

      const result = await model.generateContent(prompt);
     const response = await result.response;
      
      // 3. Parse and set results
      const rawText = response.text();
      const cleanedText = rawText.replace(/```json|```/g, "").trim();
      setResult(JSON.parse(cleanedText));

    } catch (err: any) {
      console.error(err);
      setError('Analysis failed. Please check your API key.');
    } finally {
      setLoading(false);
    }
  };

  const getScoreTextColor = (score: number | null) => {
    if (score === null) return 'text-gray-400';
    if (score >= 75) return 'text-emerald-400';
    if (score >= 51) return 'text-amber-400';
    return 'text-rose-400';
  };

  const getScoreBorderColor = (score: number | null) => {
    if (score === null) return 'border-gray-500/20';
    if (score >= 75) return 'border-emerald-500/20';
    if (score >= 51) return 'border-amber-500/20';
    return 'border-rose-500/20';
  };

  const getBarBgColor = (strength: number) => {
    if (strength >= 75) return 'bg-emerald-500';
    if (strength >= 51) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  return (
    <div className="min-h-screen bg-[#111827] text-white">
      {/* Header */}
      <div className="bg-gradient-to-b from-[#1f2937] to-[#111827] pt-12 pb-8 border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-4 text-center flex flex-col items-center">
          <div className="flex items-center justify-center mb-8">
            <div className="flex items-center relative">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-[#a3e635] to-[#65a30d] flex items-center justify-center border border-white/10 p-3 shadow-lg shadow-lime-500/20">
                <svg className="w-10 h-10 text-[#1a2e05]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </div>
              <div className="w-8 sm:w-14 px-0.5"><svg className="w-full h-8 text-sky-500/50" viewBox="0 0 60 30"><path d="M0 15h20l5-8h10l5 8h20" stroke="currentColor" strokeWidth="2" fill="none" /><circle cx="25" cy="7" r="1.5" fill="currentColor" /></svg></div>
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-[#0ea5e9] to-[#0369a1] flex items-center justify-center border-2 border-sky-400/50 p-3 shadow-xl shadow-sky-500/30 z-10">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              </div>
              <div className="w-8 sm:w-14 px-0.5"><svg className="w-full h-8 text-amber-500/50" viewBox="0 0 60 30"><path d="M0 15h20l5 8h10l5-8h20" stroke="currentColor" strokeWidth="2" fill="none" /><circle cx="25" cy="23" r="1.5" fill="currentColor" /></svg></div>
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-[#fbbf24] to-[#d97706] flex items-center justify-center border border-white/10 p-3 shadow-lg shadow-amber-500/20">
                <svg className="w-10 h-10 text-[#451a03]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              </div>
            </div>
          </div>
          <h1 className="text-5xl font-black tracking-tight mb-2 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">My Smart Path</h1>
          <p className="text-sky-400 font-bold text-xl tracking-wide uppercase italic">Intelligent Career Alignment</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto py-12 px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {/* Inputs */}
          <div className="flex flex-col space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Resume</label>
              <div className="flex gap-2">
                <button onClick={() => fileInputRef.current?.click()} className="text-[10px] font-black bg-gray-800 px-3 py-1 rounded-md border border-gray-700 hover:bg-gray-700 transition-colors uppercase">Upload</button>
                <button onClick={handleGoogleDriveClick} className="text-[10px] font-black bg-gray-800 px-3 py-1 rounded-md border border-gray-700 hover:bg-gray-700 transition-colors flex items-center gap-1.5 uppercase">
                  <svg className="w-3 h-3" viewBox="0 0 48 48">
                    <path fill="#FFC107" d="M17 6h14l9 16H26l-9-16z"/><path fill="#1976D2" d="M26 22h19l-7 12H19l7-12z"/><path fill="#4CAF50" d="M31 6l8 16-12 20H13l18-36z"/>
                  </svg>
                  Drive
                </button>
              </div>
            </div>
            <textarea
              className="w-full p-6 rounded-3xl bg-gray-900 border-2 border-gray-800 text-white min-h-[400px] outline-none focus:border-indigo-500 transition-all font-mono text-xs"
              placeholder="Paste candidate resume..."
              value={resume}
              onChange={(e) => setResume(e.target.value)}
            />
            <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => e.target.files?.[0] && handleFileRead(e.target.files[0])} />
          </div>
          <div className="flex flex-col space-y-4">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Job Description</label>
            <textarea
              className="w-full p-6 rounded-3xl bg-gray-900 border-2 border-gray-800 text-white min-h-[400px] outline-none focus:border-indigo-500 transition-all font-mono text-xs"
              placeholder="Paste requirements..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-center mb-16">
          <button
            onClick={analyzeMatch}
            disabled={loading}
            className={`px-12 py-5 rounded-full font-black text-lg text-white transition-all transform hover:scale-105 active:scale-95 shadow-2xl ${loading ? 'bg-gray-700' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20'}`}
          >
            {loading ? 'AI Engine Processing...' : 'Run My Path'}
          </button>
        </div>

        {error && <div className="mb-8 p-6 bg-rose-900/30 border border-rose-500/50 text-rose-200 rounded-3xl font-bold">{error}</div>}

        {result && (
          <div className="space-y-12 animate-in fade-in duration-700 pb-20">
            {/* SECTION 1 */}
            <div className="bg-gray-900 rounded-[3rem] border border-gray-800 overflow-hidden shadow-3xl">
              <div className={`bg-gradient-to-r p-10 flex flex-col md:flex-row gap-10 items-center ${result.section1.score >= 75 ? 'from-emerald-500/10' : result.section1.score >= 51 ? 'from-amber-500/10' : 'from-rose-500/10'} to-transparent`}>
                <div className="flex-shrink-0 relative">
                  <div className={`w-40 h-40 flex items-center justify-center border-8 ${getScoreBorderColor(result.section1.score)} rounded-full`}>
                    <span className={`text-5xl font-black ${getScoreTextColor(result.section1.score)}`}>{result.section1.score}</span>
                  </div>
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-gray-900 px-4 py-1 border border-gray-700 rounded-full text-[10px] font-black text-gray-400 uppercase tracking-tighter">ATS SCORE</div>
                </div>
                <div className="flex-1 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-3xl font-black text-white">SECTION 1: ATS Formatting</h2>
                    <span className={`px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest ${result.section1.verdict === 'Machine Readable' ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                      {result.section1.verdict}
                    </span>
                  </div>
                  <div className="bg-gray-950 p-6 rounded-2xl border border-gray-800 text-gray-300 italic leading-relaxed">
                    <span className={`font-black uppercase text-xs block mb-2 ${getScoreTextColor(result.section1.score)}`}>Audit Summary</span>
                    "{result.section1.audit}"
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 2 */}
            <div className="bg-gray-900 rounded-[3rem] border border-gray-800 overflow-hidden shadow-3xl">
              <div className={`bg-gradient-to-r p-10 space-y-10 ${result.section2.score !== null ? (result.section2.score >= 75 ? 'from-emerald-500/10' : result.section2.score >= 51 ? 'from-amber-500/10' : 'from-rose-500/10') : 'from-sky-500/10'} to-transparent`}>
                <div className="flex flex-col md:flex-row gap-10 items-center">
                  <div className="flex-shrink-0 relative">
                    <div className={`w-40 h-40 flex items-center justify-center border-8 ${getScoreBorderColor(result.section2.score)} rounded-full`}>
                      <span className={`text-5xl font-black ${getScoreTextColor(result.section2.score)}`}>{result.section2.score ?? '--'}</span>
                    </div>
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-gray-900 px-4 py-1 border border-gray-700 rounded-full text-[10px] font-black text-gray-400 uppercase tracking-tighter">ALIGNMENT</div>
                  </div>
                  <div className="flex-1 space-y-4">
                    <h2 className="text-3xl font-black text-white">SECTION 2: Career Alignment</h2>
                    <div className="bg-gray-950 p-6 rounded-2xl border border-gray-800">
                      <p className={`font-black text-lg mb-2 italic ${getScoreTextColor(result.section2.score)}`}>"{result.section2.matchVerdict}"</p>
                      <p className="text-sm text-gray-300 leading-relaxed font-medium">
                        {result.section2.analysis}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-10">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <div className="space-y-6">
                      <h3 className="text-xl font-black text-emerald-400 uppercase tracking-tighter flex items-center">
                        <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                        Strength Indicators (Fits)
                      </h3>
                      <div className="space-y-4">
                        {result.section2.top3Fits.map((fit, i) => (
                          <div key={i} className="bg-emerald-500/5 border border-emerald-500/20 p-5 rounded-2xl text-emerald-100 font-bold flex items-center">
                            <span className="mr-4 text-emerald-500 opacity-50">0{i+1}</span> {fit}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-6">
                      <h3 className="text-xl font-black text-rose-400 uppercase tracking-tighter flex items-center">
                        <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        Gap Analysis
                      </h3>
                      <div className="space-y-4">
                        {result.section2.top3Gaps.map((gap, i) => (
                          <div key={i} className="bg-rose-500/5 border border-rose-500/20 p-5 rounded-2xl text-rose-100 font-bold flex items-center">
                            <span className="mr-4 text-rose-500 opacity-50">0{i+1}</span> {gap}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="bg-amber-500/5 border-2 border-dashed border-amber-500/30 p-8 rounded-[3rem] relative">
                    <div className="absolute -top-3 left-8 bg-amber-500 text-[#451a03] text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">Power Bullet Optimization</div>
                    <h4 className="text-xl font-bold text-white mb-2">Strategy: Action Step</h4>
                    <p className="text-amber-100 font-black italic text-lg leading-relaxed">"{result.section2.actionStep}"</p>
                  </div>
                </div>
              </div>
            </div>

            {/* TRANSFERABLE SKILLS */}
            <div className="bg-gray-900 rounded-[3rem] border border-gray-800 p-10 shadow-3xl">
              <h3 className="text-3xl font-black text-indigo-400 mb-10 flex items-center uppercase tracking-tighter">
                <span className="bg-indigo-600 text-white p-3 rounded-2xl mr-5 shadow-lg shadow-indigo-500/30">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </span>
                Transferable Skills Mapping
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                {result.transferableSkills.map((item, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between items-end mb-3">
                      <div className="space-y-1">
                        <h4 className="font-black text-white text-xl uppercase tracking-wide">{item.skill}</h4>
                        <p className="text-sm text-gray-500 font-bold max-w-md">{item.relevance}</p>
                      </div>
                      <span className={`text-2xl font-black ${getScoreTextColor(item.strength)}`}>
                        {item.strength}%
                      </span>
                    </div>
                    <div className="h-3 w-full bg-gray-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-1000 ${getBarBgColor(item.strength)}`} style={{ width: `${item.strength}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}

export default App;
