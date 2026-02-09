/* MY SMART PATH - FINAL VERSION 2.2.0 (WORKING WITH GEMINI-FLASH-LATEST) */
import React, { useState, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

const PDFJS_URL = 'https://esm.sh/pdfjs-dist@4.10.38';
const PDFJS_WORKER_URL = 'https://esm.sh/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';

const App: React.FC = () => {
  const [resume, setResume] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [parsingFile, setParsingFile] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>(['gemini-flash-latest']);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-flash-latest');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-discover models on mount
    discoverModels();
  }, []);

  const discoverModels = async () => {
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) return;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      if (response.ok) {
        const data = await response.json();
        const models = data.models
          ?.filter((model: any) => model.supportedGenerationMethods?.includes('generateContent'))
          ?.map((model: any) => model.name.replace('models/', ''))
          || [];

        setAvailableModels(models);
        if (models.length > 0 && !models.includes(selectedModel)) {
          const flashModel = models.find((m: string) => m.includes('flash'));
          setSelectedModel(flashModel || models[0]);
        }
      }
    } catch (err) {
      console.log('Model discovery optional - using default');
    }
  };

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
    } catch (err) {
      throw new Error('Failed to parse PDF. Please try a text file instead.');
    }
  };

  const handleFileRead = async (file: File) => {
    setError(null);
    setParsingFile(true);
    try {
      if (file.name.toLowerCase().endsWith('.pdf')) {
        const text = await extractTextFromPDF(file);
        setResume(text);
      } else {
        const reader = new FileReader();
        reader.onload = (e) => setResume(e.target?.result as string);
        reader.readAsText(file);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setParsingFile(false);
    }
  };

  const analyzeMatch = async () => {
    if (!resume.trim()) return setError('Please provide a resume to begin.');

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      return setError('API Key not found. Please add VITE_GEMINI_API_KEY to your environment variables.');
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent`;

      const prompt = `You are an expert career advisor and ATS specialist. Analyze the resume against the job description and provide a structured assessment.

CRITICAL: Return ONLY a valid JSON object. No markdown, no code fences, no additional explanations.

Structure your response EXACTLY like this format:
{
  "section1": {
    "score": 85,
    "verdict": "MACHINE READABLE",
    "audit": "Your resume is well-structured with clear sections for experience, education, and skills."
  },
  "section2": {
    "score": 80,
    "headline": "Strong Technical Alignment with Room for Growth",
    "analysis": "Your React experience directly matches requirements. However, the job emphasizes leadership which your resume shows limited experience with.",
    "strengthIndicators": ["React expertise", "JavaScript", "Agile"],
    "gapAnalysis": ["Team leadership", "Strategic planning"],
    "actionStep": "Add 1-2 bullet points about leadership or architectural contributions."
  },
  "skillsMapping": [
    {"skill": "React", "pct": 95},
    {"skill": "JavaScript", "pct": 90},
    {"skill": "Communication", "pct": 85},
    {"skill": "Backend", "pct": 60},
    {"skill": "Leadership", "pct": 40}
  ]
}

RESUME TO ANALYZE:
${resume.substring(0, 6000)}

JOB DESCRIPTION TO MATCH AGAINST:
${jobDescription.substring(0, 4000)}

Provide analysis in the exact JSON format above.`;

      const response = await fetch(`${endpoint}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.3,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 2048,
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE"
            }
          ]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API Error: ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();

      if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
        throw new Error('Invalid response from API');
      }

      const text = data.candidates[0].content.parts[0].text;

      // Clean and parse JSON
      const cleanedText = text.replace(/```json|```/g, '').trim();
      const start = cleanedText.indexOf('{');
      const end = cleanedText.lastIndexOf('}') + 1;

      if (start === -1 || end === 0) {
        throw new Error('No valid JSON found in response');
      }

      const jsonText = cleanedText.substring(start, end);
      const parsedResult = JSON.parse(jsonText);

      // Validate structure
      if (!parsedResult.section2 || !parsedResult.section2.score || !parsedResult.skillsMapping) {
        throw new Error('Invalid response structure');
      }

      setResult(parsedResult);

    } catch (err: any) {
      console.error('Analysis Error:', err);
      setError(`Analysis failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (s: number) => {
    if (s >= 85) return 'text-emerald-400 bg-emerald-400/10';
    if (s >= 70) return 'text-emerald-300 bg-emerald-400/5';
    if (s >= 55) return 'text-amber-400 bg-amber-400/10';
    if (s >= 40) return 'text-amber-300 bg-amber-400/5';
    return 'text-rose-400 bg-rose-400/10';
  };

  const getScoreBgColor = (s: number) => {
    if (s >= 85) return 'bg-emerald-500';
    if (s >= 70) return 'bg-emerald-400';
    if (s >= 55) return 'bg-amber-500';
    if (s >= 40) return 'bg-amber-400';
    return 'bg-rose-500';
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
      {/* HEADER */}
      <div className="relative overflow-hidden bg-linear-to-b from-gray-900 to-gray-950 pt-16 pb-12 border-b border-gray-800">
        <div className="absolute inset-0 bg-grid-white/5 bg-size-[20px_20px]"></div>
        <div className="relative max-w-6xl mx-auto px-4 text-center">
          <h1 className="text-5xl md:text-6xl font-black mb-4 bg-linear-to-r from-white via-gray-300 to-gray-400 bg-clip-text text-transparent uppercase tracking-tight">
            My Smart Path
          </h1>
          <p className="text-sky-400 font-bold text-xl tracking-widest uppercase italic">
            Intelligent Career Alignment
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <div className="px-4 py-2 bg-gray-800/50 backdrop-blur-sm rounded-full border border-gray-700">
              <span className="text-sm text-gray-300">Model: </span>
              <span className="text-sm font-bold text-emerald-400 ml-1">{selectedModel}</span>
            </div>
            <div className="px-4 py-2 bg-gray-800/50 backdrop-blur-sm rounded-full border border-gray-700">
              <span className="text-sm text-gray-300">Status: </span>
              <span className="text-sm font-bold text-emerald-400 ml-1">Ready</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto py-12 px-4">
        {/* INPUT SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* RESUME BOX */}
          <div className="group">
            <div className="flex justify-between items-center mb-4">
              <label className="text-sm font-bold text-gray-300 uppercase tracking-widest flex items-center">
                <svg className="w-5 h-5 mr-2 text-sky-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                </svg>
                Resume
              </label>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-bold bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg border border-gray-700 uppercase transition-all hover:scale-105 active:scale-95 cursor-pointer"
              >
                {parsingFile ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Parsing...
                  </span>
                ) : 'Upload PDF/Text'}
              </button>
            </div>
            <textarea
              className="w-full h-96 p-6 rounded-2xl bg-gray-900/50 backdrop-blur-sm border-2 border-gray-800 text-white outline-none focus:border-sky-500 font-mono text-sm transition-all resize-none shadow-2xl group-hover:border-gray-700"
              value={resume}
              onChange={e => setResume(e.target.value)}
              placeholder="Paste your resume here or upload a file..."
            />
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".pdf,.txt,.doc,.docx"
              onChange={e => e.target.files?.[0] && handleFileRead(e.target.files[0])}
            />
          </div>

          {/* JOB DESCRIPTION BOX */}
          <div className="group">
            <label className="text-sm font-bold text-gray-300 uppercase tracking-widest mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-sky-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
              </svg>
              Job Description
            </label>
            <textarea
              className="w-full h-96 p-6 rounded-2xl bg-gray-900/50 backdrop-blur-sm border-2 border-gray-800 text-white outline-none focus:border-sky-500 font-mono text-sm transition-all resize-none shadow-2xl group-hover:border-gray-700"
              value={jobDescription}
              onChange={e => setJobDescription(e.target.value)}
              placeholder="Paste the job description here..."
            />
          </div>
        </div>

        {/* ANALYZE BUTTON */}
        <div className="flex justify-center mb-16">
          <button
            onClick={analyzeMatch}
            disabled={loading || !resume.trim()}
            className={`px-16 py-5 cursor-pointer rounded-full font-black text-lg shadow-2xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group ${loading ? 'bg-linear-to-r from-indigo-900 to-purple-900' : 'bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700'
              }`}
          >
            <span className="relative z-10 flex items-center">
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Analyzing Match...
                </>
              ) : (
                'Analyze Career Path'
              )}
            </span>
            <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
          </button>
        </div>

        {/* ERROR DISPLAY */}
        {error && (
          <div className="mb-8 p-6 bg-linear-to-r from-rose-900/20 to-pink-900/20 backdrop-blur-sm rounded-2xl border border-rose-800/50">
            <div className="flex items-start">
              <svg className="w-6 h-6 text-rose-400 mr-3 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div>
                <h3 className="text-lg font-bold text-rose-300 mb-2">Analysis Error</h3>
                <p className="text-rose-200/90 mb-3">{error}</p>
                <div className="text-sm text-rose-300/80">
                  <p className="font-semibold">Quick fix:</p>
                  <p>Ensure your <code className="bg-rose-900/50 px-2 py-0.5 rounded">VITE_GEMINI_API_KEY</code> is set in Vercel environment variables.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* RESULTS DISPLAY */}
        {result && (
          <div className="bg-linear-to-br from-gray-900/80 to-gray-950/80 backdrop-blur-sm p-8 md:p-10 rounded-3xl border border-gray-800 animate-in fade-in slide-in-from-bottom-4 duration-700 shadow-2xl">
            {/* SCORE HEADER */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-8 mb-10">
              <div>
                <div className={`text-8xl font-black mb-2 ${getScoreColor(result.section2.score)} inline-block px-6 py-4 rounded-2xl`}>
                  {result.section2.score}%
                </div>
                <div className="text-gray-400 text-sm uppercase tracking-widest mt-2">Overall Match Score</div>
              </div>
              <div className="md:text-right">
                <div className="inline-block px-4 py-2 bg-emerald-900/30 rounded-full border border-emerald-800/50">
                  <span className="text-lg font-bold text-emerald-300">{result.section1.verdict}</span>
                </div>
                <div className="text-gray-400 text-sm mt-2">Resume ATS Readability</div>
                <div className="mt-4 p-4 bg-gray-800/50 rounded-xl">
                  <p className="text-gray-300 text-sm">{result.section1.audit}</p>
                </div>
              </div>
            </div>

            {/* HEADLINE & ANALYSIS */}
            <div className="mb-10">
              <div className="inline-flex items-center px-4 py-2 bg-linear-to-r from-sky-900/30 to-indigo-900/30 rounded-full mb-4">
                <svg className="w-5 h-5 text-sky-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
                </svg>
                <span className="text-sky-400 font-bold">Analysis Summary</span>
              </div>
              <h3 className="text-3xl font-black italic mb-6 bg-linear-to-r from-white to-gray-300 bg-clip-text text-transparent">
                "{result.section2.headline}"
              </h3>
              <div className="p-6 bg-linear-to-r from-gray-800/40 to-gray-900/40 rounded-2xl border border-gray-700/50">
                <p className="text-gray-200 text-lg leading-relaxed">{result.section2.analysis}</p>
              </div>
            </div>

            {/* STRENGTHS & GAPS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
              <div className="bg-linear-to-br from-emerald-900/10 to-emerald-950/10 p-6 rounded-2xl border border-emerald-800/30">
                <h4 className="text-xl font-bold mb-6 flex items-center">
                  <svg className="w-6 h-6 text-emerald-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="bg-linear-to-r from-emerald-400 to-emerald-300 bg-clip-text text-transparent">Key Strengths</span>
                </h4>
                <ul className="space-y-4">
                  {result.section2.strengthIndicators.map((strength: string, index: number) => (
                    <li key={index} className="flex items-center p-3 bg-emerald-900/20 rounded-lg hover:bg-emerald-900/30 transition-colors">
                      <div className="w-8 h-8 flex items-center justify-center bg-emerald-900/50 rounded-full mr-3">
                        <span className="text-emerald-300 font-bold">{index + 1}</span>
                      </div>
                      <span className="text-gray-200">{strength}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-linear-to-br from-amber-900/10 to-amber-950/10 p-6 rounded-2xl border border-amber-800/30">
                <h4 className="text-xl font-bold mb-6 flex items-center">
                  <svg className="w-6 h-6 text-amber-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span className="bg-linear-to-r from-amber-400 to-amber-300 bg-clip-text text-transparent">Areas for Improvement</span>
                </h4>
                <ul className="space-y-4">
                  {result.section2.gapAnalysis.map((gap: string, index: number) => (
                    <li key={index} className="flex items-center p-3 bg-amber-900/20 rounded-lg hover:bg-amber-900/30 transition-colors">
                      <div className="w-8 h-8 flex items-center justify-center bg-amber-900/50 rounded-full mr-3">
                        <span className="text-amber-300 font-bold">{index + 1}</span>
                      </div>
                      <span className="text-gray-200">{gap}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* SKILLS MATCH ANALYSIS */}
            <div className="mt-12 pt-12 border-t border-gray-800/50">
              <div className="text-center mb-10">
                <h4 className="text-3xl font-bold mb-3 bg-linear-to-r from-white to-gray-300 bg-clip-text text-transparent">
                  Skills Match Analysis
                </h4>
                <p className="text-gray-400 max-w-2xl mx-auto">
                  How your skills compare to the job requirements
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {result.skillsMapping.map((skill: any, index: number) => (
                  <div
                    key={index}
                    className="bg-linear-to-br from-gray-800/40 to-gray-900/40 p-5 rounded-xl border border-gray-700/50 hover:border-gray-600/50 transition-all hover:scale-[1.02] group"
                  >
                    <div className="flex justify-between items-center mb-4">
                      <span className="font-bold text-lg text-gray-200 group-hover:text-white transition-colors">
                        {skill.skill}
                      </span>
                      <span className={`text-2xl font-black px-3 py-1 rounded-full ${getScoreColor(skill.pct)}`}>
                        {skill.pct}%
                      </span>
                    </div>
                    <div className="mb-2">
                      <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${getScoreBgColor(skill.pct)} transition-all duration-1000 ease-out`}
                          style={{ width: `${skill.pct}%` }}
                        ></div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 mt-3 flex justify-between">
                      <span className={skill.pct >= 85 ? 'text-emerald-400 font-bold' : ''}>Weak</span>
                      <span className={skill.pct >= 55 && skill.pct < 85 ? 'text-amber-400 font-bold' : ''}>Average</span>
                      <span className={skill.pct >= 85 ? 'text-emerald-400 font-bold' : ''}>Strong</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* RECOMMENDED ACTION */}
            {result.section2.actionStep && (
              <div className="mt-12 p-8 bg-linear-to-r from-sky-900/20 to-indigo-900/20 rounded-2xl border border-sky-800/30 backdrop-blur-sm">
                <div className="flex items-center mb-4">
                  <svg className="w-8 h-8 text-sky-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                  </svg>
                  <h4 className="text-2xl font-bold bg-linear-to-r from-sky-400 to-cyan-400 bg-clip-text text-transparent">
                    Recommended Action
                  </h4>
                </div>
                <div className="p-5 bg-black/20 rounded-xl">
                  <p className="text-gray-200 text-lg leading-relaxed">{result.section2.actionStep}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div className="text-center text-gray-500 text-sm py-8 border-t border-gray-800/50 bg-linear-to-t from-gray-950 to-transparent">
        <div className="max-w-6xl mx-auto px-4">
          <p className="mb-2">Powered by Google Gemini AI • Model: <span className="text-emerald-400 font-mono">{selectedModel}</span></p>
        </div>
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