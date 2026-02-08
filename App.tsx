import React, { useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenerativeAI } from "@google/generative-ai";

const PDFJS_URL = 'https://esm.sh/pdfjs-dist@4.10.38';
const PDFJS_WORKER_URL = 'https://esm.sh/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';

const App: React.FC = () => {
  const [resume, setResume] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [parsingFile, setParsingFile] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const extractTextFromPDF = async (file: File): Promise<string> => {
    try {
      // @ts-ignore
      const pdfjsLib = await import(PDFJS_URL);
      pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((item: any) => item.str).join(' ') + '\n';
      }
      return text;
    } catch (err) { throw new Error('PDF Parse Error'); }
  };

  const handleFileRead = async (file: File) => {
    setError(null);
    setParsingFile(true);
    try {
      if (file.name.toLowerCase().endsWith('.pdf')) setResume(await extractTextFromPDF(file));
      else {
        const reader = new FileReader();
        reader.onload = (e) => setResume(e.target?.result as string);
        reader.readAsText(file);
      }
    } catch (err: any) { setError(err.message); }
    finally { setParsingFile(false); }
  };

  const analyzeMatch = async () => {
    if (!resume.trim()) return setError('Please provide a resume.');
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // API Key and Stable Model Configuration
      const genAI = new GoogleGenerativeAI("AIzaSyAZlGZd9KaDy9bJf0Sv1gnOGlasj6lNXY8");
     const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
      
      const prompt = `
        Return ONLY a JSON object. No markdown.
        Structure:
        {
          "section1": { "score": 85, "verdict": "MACHINE READABLE", "audit": "text" },
          "section2": { 
            "score": 80, "headline": "Strong Fit", "analysis": "text",
            "strengthIndicators": ["fit1", "fit2"], "gapAnalysis": ["gap1", "gap2"], "actionStep": "text"
          },
          "skillsMapping": [{"skill": "STAKEHOLDER MGMT", "pct": 90}, {"skill": "RECRUITING OPS", "pct": 85}, {"skill": "AI TOOLS", "pct": 75}, {"skill": "COMMUNICATION", "pct": 95}]
        }
        Resume: ${resume.substring(0, 5000)}
        JD: ${jobDescription.substring(0, 3000)}
      `;

      const request = await model.generateContent(prompt);
      const response = await request.response;
      const text = response.text();
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}') + 1;
      setResult(JSON.parse(text.substring(start, end)));
    } catch (err: any) {
      console.error("AI Error:", err);
      setError(`Access Denied (403) or Connection Error. Check Google AI Studio key restrictions.`);
    } finally { setLoading(false); }
  };

  const getScoreColor = (s: number) => s >= 75 ? 'text-emerald-400' : s >= 50 ? 'text-amber-400' : 'text-rose-400';

  return (
    <div className="min-h-screen bg-[#111827] text-white">
      {/* HEADER */}
      <div className="bg-gradient-to-b from-[#1f2937] to-[#111827] pt-12 pb-8 border-b border-gray-800 text-center">
        <div className="max-w-6xl mx-auto px-4 flex flex-col items-center">
          <div className="flex items-center justify-center mb-8 relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#a3e635] to-[#65a30d] flex items-center justify-center border border-white/10 p-3 shadow-lg shadow-lime-500/20">
              <svg className="w-10 h-10 text-[#1a2e05]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeWidth="1.5"/></svg>
            </div>
            <div className="w-10 h-1 px-1"><div className="w-full h-0.5 bg-sky-500/30"></div></div>
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#0ea5e9] to-[#0369a1] flex items-center justify-center border-2 border-sky-400/50 p-3 shadow-xl shadow-sky-500/30 z-10">
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" strokeWidth="1.5"/></svg>
            </div>
            <div className="w-10 h-1 px-1"><div className="w-full h-0.5 bg-amber-500/30"></div></div>
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#fbbf24] to-[#d97706] flex items-center justify-center border border-white/10 p-3 shadow-lg shadow-amber-500/20">
              <svg className="w-10 h-10 text-[#451a03]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" strokeWidth="1.5"/></svg>
            </div>
          </div>
          <h1 className="text-5xl font-black mb-2 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">My Smart Path</h1>
          <p className="text-sky-400 font-bold text-xl tracking-wide uppercase italic">Intelligent Career Alignment</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto py-12 px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12 items-stretch">
          <div className="flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Resume</label>
              <div className="flex gap-2">
                <button onClick={() => fileInputRef.current?.click()} className="text-[10px] font-black bg-gray-800 px-3 py-1 rounded-md border border-gray-700 hover:bg-gray-700 uppercase">
                  {parsingFile ? 'Parsing...' : 'Upload'}
                </button>
              </div>
            </div>
            <textarea className="w-full flex-grow p-6 rounded-3xl bg-gray-900 border-2 border-gray-800 text-white min-h-[400px] outline-none focus:border-indigo-500 font-mono text-xs transition-all" value={resume} onChange={e => setResume(e.target.value)} />
            <input type="file" ref={fileInputRef} className="hidden" onChange={e => e.target.files?.[0] && handleFileRead(e.target.files[0])} />
          </div>
          
          <div className="flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Job Description</label>
            </div>
            <textarea className="w-full flex-grow p-6 rounded-3xl bg-gray-900 border-2 border-gray-800 text-white min-h-[400px] outline-none focus:border-indigo-500 font-mono text-xs transition-all" value={jobDescription} onChange={e => setJobDescription(e.target.value)} />
          </div>
        </div>

        <div className="flex justify-center mb-16">
          <button 
            onClick={analyzeMatch} 
            disabled={loading} 
            className={`px-12 py-5 rounded-full font-black text-lg shadow-2xl transition-all active:scale-95 flex items-center gap-3 ${loading ? 'bg-indigo-900 animate-pulse cursor-wait' : 'bg-indigo-600 hover:bg-indigo-700'}`}
          >
            {loading ? 'Scanning Path...' : 'Run My Path'}
          </button>
        </div>

        {error && <div className="p-4 bg-rose-900/20 border border-rose-500 rounded-2xl text-rose-200 mb-8">{error}</div>}

        {result && (
          <div className="space-y-12 animate-in fade-in duration-700">
            <div className="bg-gray-900 p-10 rounded-[3rem] border border-gray-800 flex flex-col md:flex-row gap-10 items-center">
              <div className={`text-7xl font-black ${getScoreColor(result.section1.score)}`}>{result.section1.score}</div>
              <div className="space-y-4">
                 <div className="flex items-center gap-4">
                   <h2 className="text-2xl font-black uppercase tracking-tighter">Section 1: ATS Formatting</h2>
                   <span className="bg-emerald-500 text-[10px] font-black px-3 py-1 rounded-full uppercase">{result.section1.verdict}</span>
                 </div>
                 <p className="text-gray-300 italic text-sm">"{result.section1.audit}"</p>
              </div>
            </div>

            <div className="bg-gray-900 p-10 rounded-[3rem] border border-gray-800">
               <div className="flex gap-8 items-center border-b border-gray-800 pb-8 mb-8">
                  <div className={`text-7xl font-black ${getScoreColor(result.section2.score)}`}>{result.section2.score}</div>
                  <div>
                    <h3 className={`text-2xl font-black italic ${getScoreColor(result.section2.score)}`}>"{result.section2.headline}"</h3>
                    <p className="text-gray-400 text-sm mt-2">{result.section2.analysis}</p>
                  </div>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Strength Indicators (Fits)</h4>
                    {result.section2.strengthIndicators.map((s: string, i: number) => (
                      <div key={i} className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-2xl text-xs text-emerald-100 italic">0{i+1}. {s}</div>
                    ))}
                  </div>
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Gap Analysis</h4>
                    {result.section2.gapAnalysis.map((g: string, i: number) => (
                      <div key={i} className="bg-rose-500/5 border border-rose-500/20 p-4 rounded-2xl text-xs text-rose-100 italic">0{i+1}. {g}</div>
                    ))}
                  </div>
               </div>
               <div className="bg-amber-500/10 border-2 border-dashed border-amber-500/30 p-8 rounded-[2rem] text-center">
                  <h4 className="text-amber-400 text-[10px] font-black uppercase mb-2">Strategy: Action Step</h4>
                  <p className="text-amber-100 italic text-lg font-bold">"{result.section2.actionStep}"</p>
               </div>
            </div>

            <div className="bg-gray-900 p-10 rounded-[3rem] border border-gray-800">
               <h3 className="text-sm font-black uppercase mb-8 flex items-center gap-2 tracking-widest text-gray-400">Transferable Skills Mapping</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                  {result.skillsMapping.map((s: any, i: number) => (
                    <div key={i} className="space-y-3">
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                        <span>{s.skill}</span>
                        <span className={getScoreColor(s.pct)}>{s.pct}%</span>
                      </div>
                      <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-1000" style={{ width: `${s.pct}%` }} />
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

// INITIALIZATION LOGIC
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}

export default App;
