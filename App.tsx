import React, { useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { RecruiterAnalysis } from './types';

// PDF and Word parsing support
const PDFJS_URL = 'https://esm.sh/pdfjs-dist@4.10.38';
const PDFJS_WORKER_URL = 'https://esm.sh/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
const MAMMOTH_URL = 'https://esm.sh/mammoth@1.8.0';

const App: React.FC = () => {
  const [resume, setResume] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RecruiterAnalysis | null>(null);
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
    const name = file.name.toLowerCase();
    try {
      if (name.endsWith('.pdf')) setResume(await extractTextFromPDF(file));
      else {
        const reader = new FileReader();
        reader.onload = (e) => setResume(e.target?.result as string);
        reader.readAsText(file);
      }
    } catch (err: any) { setError(err.message); }
  };

  const analyzeMatch = async () => {
    if (!resume.trim()) return setError('Please provide a resume.');
    setLoading(true);
    setError(null);

    try {
      // THE NEW 2026 STANDARD INITIALIZATION
      const genAI = new GoogleGenerativeAI("AIzaSyAZlGZd9KaDy9bJf0Sv1gnOGlasj6lNXY8");
      
      // We are going back to the base model name but keeping the v1 requirement
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `Analyze this Resume against this Job Description. 
      Resume: ${resume} 
      JD: ${jobDescription}
      Return ONLY a JSON object matching the RecruiterAnalysis type.`;

      const request = await model.generateContent(prompt);
      const response = await request.response;
      const text = response.text().replace(/```json|```/g, "").trim();
      setResult(JSON.parse(text));
    } catch (err: any) {
      console.error(err);
      setError("AI Engine error. This is likely a project permission issue in Google AI Studio.");
    } finally {
      setLoading(false);
    }
  };

  const getScoreTextColor = (s: number | null) => s && s >= 75 ? 'text-emerald-400' : s && s >= 50 ? 'text-amber-400' : 'text-rose-400';

  return (
    <div className="min-h-screen bg-[#111827] text-white p-8">
      <div className="max-w-4xl mx-auto text-center mb-12">
        <h1 className="text-4xl font-black mb-2">My Smart Path</h1>
        <p className="text-sky-400 uppercase tracking-widest font-bold">Intelligent Career Alignment</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <textarea 
          className="bg-gray-900 border-2 border-gray-800 p-4 rounded-2xl h-64 text-sm"
          placeholder="Paste Resume..."
          value={resume}
          onChange={(e) => setResume(e.target.value)}
        />
        <textarea 
          className="bg-gray-900 border-2 border-gray-800 p-4 rounded-2xl h-64 text-sm"
          placeholder="Paste Job Description..."
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
        />
      </div>

      <div className="flex justify-center mb-12">
        <button 
          onClick={analyzeMatch}
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-700 px-12 py-4 rounded-full font-black transition-all"
        >
          {loading ? 'Processing...' : 'Run Analysis'}
        </button>
      </div>

      {error && <div className="bg-rose-900/20 border border-rose-500 p-4 rounded-xl text-rose-200 mb-8">{error}</div>}

      {result && (
        <div className="bg-gray-900 p-8 rounded-[2rem] border border-gray-800">
          <div className="text-center mb-8">
            <div className="text-6xl font-black mb-2">{result.section1.score}</div>
            <div className="text-xs uppercase tracking-tighter text-gray-400">ATS Compatibility Score</div>
          </div>
          <div className="space-y-4">
            <p className="italic text-gray-300">"{result.section1.audit}"</p>
            <div className="p-4 bg-black/30 rounded-xl border border-gray-700">
              <h3 className="font-bold text-sky-400 mb-2">Next Step:</h3>
              <p>{result.section2.actionStep}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}

export default App;
