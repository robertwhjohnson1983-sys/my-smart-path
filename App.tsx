/* HARD RESET - VERSION 2.0.2 */
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
    if (!resume.trim()) return setError('System Reset: Please provide a resume.');
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error("Vercel Environment Variable Missing");

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
      console.error("AI Error:", err);
      setError(`Deployment Error: ${err.message}`);
    } finally { setLoading(false); }
  };

  const getScoreColor = (s: number) => s >= 75 ? 'text-emerald-400' : s >= 50 ? 'text-amber-400' : 'text-rose-400';

  return (
    <div className="min-h-screen bg-[#111827] text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-black mb-8 text-center tracking-widest uppercase">My Smart Path</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <textarea className="w-full p-4 bg-gray-900 border border-gray-800 rounded-xl min-h-[300px]" placeholder="Resume..." value={resume} onChange={e => setResume(e.target.value)} />
          <textarea className="w-full p-4 bg-gray-900 border border-gray-800 rounded-xl min-h-[300px]" placeholder="Job Description..." value={jobDescription} onChange={e => setJobDescription(e.target.value)} />
        </div>
        <div className="flex justify-center mb-12">
          <button onClick={analyzeMatch} disabled={loading} className="bg-sky-600 px-12 py-4 rounded-full font-bold uppercase tracking-widest">
            {loading ? 'Analyzing...' : 'Run My Path'}
          </button>
        </div>
        {error && <div className="p-4 bg-rose-900/30 border border-rose-500 rounded-xl text-rose-200 mb-8">{error}</div>}
        {result && (
          <div className="bg-gray-900 p-8 rounded-2xl border border-gray-800">
             <div className={`text-6xl font-black mb-4 ${getScoreColor(result.section2.score)}`}>{result.section2.score}% Match</div>
             <p className="text-gray-400">{result.section2.analysis}</p>
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
