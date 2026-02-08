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

  // --- FILE PARSING LOGIC ---
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

  // --- AI ANALYSIS LOGIC ---
  const analyzeMatch = async () => {
    if (!resume.trim()) {
      setError('A resume is required for analysis.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Initialize with the Key
      const genAI = new GoogleGenerativeAI("AIzaSyAZlGZd9KaDy9bJf0Sv1gnOGlasj6lNXY8");

      // 2. USE THE STABLE VERSION v1
      const model = genAI.getGenerativeModel(
        { model: "gemini-1.5-flash" },
        { apiVersion: "v1" }
      );
      
      const prompt = `
        ROLE: Senior Talent Acquisition Specialist & Executive Resume Writer.
        TASK: Perform a high-fidelity audit of this Resume against the Job Description.
        
        RESUME: ${resume}
        JOB DESCRIPTION: ${jobDescription || "None (Provide a general career strength audit if JD is missing)"}
        
        OUTPUT: Return ONLY valid JSON matching the RecruiterAnalysis structure.
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const rawText = response.text();
      const cleanedText = rawText.replace(/```json|```/g, "").trim();
      setResult(JSON.parse(cleanedText));

    } catch (err: any) {
      console.error("AI Error Details:", err);
      setError('Analysis failed. This is usually a Google Project linking issue. Try creating a fresh API key in a new project.');
    } finally {
      setLoading(false);
    }
  };

  // --- UI HELPER FUNCTIONS ---
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
