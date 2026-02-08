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
      // Pulling key securely from Vercel Environment Variables
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error("API Key not found in Vercel settings.");

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
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
      setError(`Error: ${err.message}. Ensure VITE_GEMINI_API_KEY is set in Vercel.`);
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
            <div className="w-1
