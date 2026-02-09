/* MY SMART PATH - VERSION 2.1.0 (RESTORING UPLOADER) */
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
    if (!resume.trim()) return setError('Please provide a resume to begin.');
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error("API Key configuration missing in Vercel.");

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      const prompt = `
        Return ONLY a JSON object. No markdown.
        Structure:
        {
          "section1": { "score": 85, "verdict": "MACHINE READABLE", "audit": "text" },
          "section2": { 
            "score": 80, "headline": "Fit Analysis", "analysis": "text",
            "strengthIndicators": ["fit1"], "gapAnalysis": ["gap1"], "actionStep": "text"
          },
          "skillsMapping": [{"skill": "Skill Name", "pct": 90}]
        }
        Resume: ${resume.substring(0, 6000)}
        JD: ${jobDescription.substring(0, 4000)}
      `;

      const request = await model.generateContent(prompt);
      const response = await request.response;
      const text = response.text();
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}') + 1;
      setResult(JSON.parse(text.substring(start, end)));
    } catch (err: any) {
      setError(`AI Error: ${err.message}`);
    } finally { setLoading(false); }
  };

  const getScoreColor = (s: number) => s >= 75 ? 'text-emerald-400' : s >= 50 ? 'text-amber-400' : 'text-rose-400';

  return (
    <div className="min-h-screen bg-[#111827] text-white">
      {/* HEADER */}
      <div className="bg-gradient-to-b from-[#1f2937] to-[#111827] pt-12 pb-8 border-b border-gray-800 text-center">
        <h1 className="text-5xl font-black mb-2 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent uppercase tracking-tighter">My Smart Path</h1>
        <p className="text-sky-400 font-bold text-xl tracking-widest uppercase italic">Intelligent Career Alignment</p>
      </div>

      <div className="max-w-6xl mx-auto py-12 px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {/* RESUME BOX */}
          <div className="flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Resume</label>
              <button onClick={() => fileInputRef.current?.click()} className="text-[10px] font-black bg-gray-800 px-3 py-1 rounded-md border border-gray-700 hover:bg-gray-700 uppercase">
                {parsingFile ? 'Parsing...' : 'Upload PDF/Doc'}
              </button>
            </div>
            <textarea className="w-full flex-grow p-6 rounded-3xl bg-gray-900 border-2 border-gray-800 text-white min-h-[400px] outline-none focus:border-sky-500 font-mono text-xs transition-all" value={resume} onChange={e => setResume(e.target.value)} />
            <input type="file" ref={fileInputRef} className="hidden" onChange={e => e.target.files?.[0] && handleFileRead(e.target.files[0])} />
          </div>

          {/* JD BOX */}
          <div className="flex flex-col">
            <label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Job Description</label>
            <textarea className="w-full flex-grow p-6 rounded-3xl bg-gray-900 border-2 border-gray-800 text-white min-h-[400px] outline-none focus:border-sky-500 font-mono text-xs transition-all" value={jobDescription} onChange={e => setJobDescription(e.target.value)} />
          </div>
        </div>

        <div className="flex justify-center mb-16">
          <button onClick={analyzeMatch} disabled={loading} className={`px-12 py-5 rounded-full font-black text-lg shadow-2xl transition-all active:scale-95 ${loading ? 'bg-indigo-900 animate-pulse' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
            {loading ? 'Scanning Path...' : 'Run My Path'}
          </button>
        </div>

        {error && <div className="p-4 bg-rose-900/20 border border-rose-500 rounded-2xl text-rose-200 mb-8">{error}</div>}

        {result && (
          <div className="bg-gray-900 p-10 rounded-[3rem] border border-gray-800 animate-in fade-in slide-in-from-bottom-4 duration-700">
             <div className={`text-7xl font-black mb-4 ${getScoreColor(result.section2.score)}`}>{result.section2.score}%</div>
             <h3 className="text-2xl font-black italic mb-4">"{result.section2.headline}"</h3>
             <p className="text-gray-400 text-lg leading-relaxed">{result.section2.analysis}</p>
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
