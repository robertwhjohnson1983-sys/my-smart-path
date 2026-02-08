import React, { useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenerativeAI } from "@google/generative-ai";

// Note: Ensure your types.ts includes the updated structure below
const App: React.FC = () => {
  const [resume, setResume] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const analyzeMatch = async () => {
    if (!resume.trim()) {
      setError('A resume is required.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null); 

    try {
      const genAI = new GoogleGenerativeAI("AIzaSyAZlGZd9KaDy9bJf0Sv1gnOGlasj6lNXY8");
      const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
      
      const prompt = `
        Perform a Senior Recruiter Audit. Return ONLY a JSON object.
        REQUIRED JSON STRUCTURE:
        {
          "section1": { "score": 90, "verdict": "MACHINE READABLE", "audit": "text" },
          "section2": { 
            "score": 85, 
            "headline": "Strong Match",
            "analysis": "detailed summary",
            "strengthIndicators": ["item 1", "item 2", "item 3"],
            "gapAnalysis": ["gap 1", "gap 2", "gap 3"],
            "actionStep": "specific strategy"
          },
          "skillsMapping": [
            { "skill": "STAKEHOLDER MANAGEMENT", "pct": 95 },
            { "skill": "OPERATIONAL EFFICIENCY", "pct": 90 },
            { "skill": "DATA ANALYSIS", "pct": 85 },
            { "skill": "COMMUNICATION", "pct": 88 }
          ]
        }
        RESUME: ${resume.substring(0, 5000)}
        JD: ${jobDescription.substring(0, 3000)}
      `;

      const request = await model.generateContent(prompt);
      const response = await request.response;
      const text = response.text();
      
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}') + 1;
      const cleanedJson = text.substring(start, end);
      setResult(JSON.parse(cleanedJson));
    } catch (err: any) {
      console.error(err);
      setError('Analysis failed. Try a slightly shorter JD.');
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (s: number) => s >= 75 ? 'text-emerald-400' : s >= 50 ? 'text-amber-400' : 'text-rose-400';

  return (
    <div className="min-h-screen bg-[#111827] text-white p-8">
      {/* Header stays the same as your previous version */}
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="grid grid-cols-2 gap-4">
          <textarea className="bg-gray-900 p-4 rounded-xl h-64 text-xs font-mono border border-gray-800" value={resume} onChange={e => setResume(e.target.value)} placeholder="Resume..." />
          <textarea className="bg-gray-900 p-4 rounded-xl h-64 text-xs font-mono border border-gray-800" value={jobDescription} onChange={e => setJobDescription(e.target.value)} placeholder="Job Description..." />
        </div>

        <button onClick={analyzeMatch} className="w-full py-4 bg-indigo-600 rounded-full font-black uppercase tracking-widest hover:bg-indigo-500 transition-colors">
          {loading ? 'Analyzing...' : 'Run My Path'}
        </button>

        {result && (
          <div className="space-y-6 animate-in fade-in zoom-in duration-500">
            {/* Section 1: ATS */}
            <div className="bg-gray-900 p-8 rounded-[2rem] border border-gray-800">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold uppercase tracking-tighter">Section 1: ATS Formatting</h2>
                <span className="bg-emerald-500 text-[10px] font-black px-3 py-1 rounded-full">{result.section1.verdict}</span>
              </div>
              <div className="flex gap-6 items-center">
                <div className={`text-5xl font-black ${getScoreColor(result.section1.score)}`}>{result.section1.score}</div>
                <p className="text-gray-400 text-sm italic italic leading-relaxed">"{result.section1.audit}"</p>
              </div>
            </div>

            {/* Section 2: Career Alignment */}
            <div className="bg-gray-900 p-8 rounded-[2rem] border border-gray-800 space-y-6">
               <div className="flex gap-6 items-center border-b border-gray-800 pb-6">
                  <div className={`text-5xl font-black ${getScoreColor(result.section2.score)}`}>{result.section2.score}</div>
                  <div>
                    <h3 className={`font-bold italic ${getScoreColor(result.section2.score)}`}>"{result.section2.headline}"</h3>
                    <p className="text-gray-300 text-sm mt-1">{result.section2.analysis}</p>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-black text-emerald-400 uppercase">Strength Indicators (Fits)</h4>
                    {result.section2.strengthIndicators.map((s: string, i: number) => (
                      <div key={i} className="bg-emerald-500/5 border border-emerald-500/20 p-3 rounded-xl text-xs text-emerald-100">0{i+1}. {s}</div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-black text-rose-400 uppercase">Gap Analysis</h4>
                    {result.section2.gapAnalysis.map((g: string, i: number) => (
                      <div key={i} className="bg-rose-500/5 border border-rose-500/20 p-3 rounded-xl text-xs text-rose-100">0{i+1}. {g}</div>
                    ))}
                  </div>
               </div>

               <div className="bg-amber-500/10 border-2 border-dashed border-amber-500/30 p-6 rounded-2xl">
                  <h4 className="text-amber-400 text-[10px] font-black uppercase mb-2">Strategy: Action Step</h4>
                  <p className="text-amber-100 italic text-sm">"{result.section2.actionStep}"</p>
               </div>
            </div>

            {/* Transferable Skills Mapping */}
            <div className="bg-gray-900 p-8 rounded-[2rem] border border-gray-800">
               <h3 className="text-sm font-black uppercase mb-6 flex items-center gap-2">
                 <span className="w-6 h-6 bg-indigo-500 rounded flex items-center justify-center text-[10px]">⚡</span>
                 Transferable Skills Mapping
               </h3>
               <div className="grid grid-cols-2 gap-x-12 gap-y-6">
                  {result.skillsMapping.map((s: any, i: number) => (
                    <div key={i} className="space-y-2">
                      <div className="flex justify-between text-[10px] font-black uppercase">
                        <span>{s.skill}</span>
                        <span className={getScoreColor(s.pct)}>{s.pct}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-gray-800 rounded-full overflow-hidden">
                        <div className={`h-full bg-emerald-500 transition-all duration-1000`} style={{ width: `${s.pct}%` }}></div>
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
