import React, { useState, useRef } from 'react';
import { Upload, Video, Sparkles, Copy, Check, AlertCircle, Loader2, Wand2, Info, FileJson, Trash2, Type, Braces, Layers, Key, ExternalLink } from 'lucide-react';


export default function App() {
  // --- STATE API KEY (PENTING UNTUK DEPLOYMENT) ---
  // Di website asli, user harus memasukkan key mereka sendiri agar kuota Anda tidak tersedot/bocor.
  const [userApiKey, setUserApiKey] = useState("");

  // Mode: 'visual' (upload file) atau 'text' (input kata kunci)
  const [mode, setMode] = useState<'visual' | 'text'>('visual');
  
  // State Visual
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [frameBase64, setFrameBase64] = useState<string | null>(null);
  
  // State Text Input
  const [textInput, setTextInput] = useState("");
  
  // State General
  const [isProcessing, setIsProcessing] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- LOGIC 1: EXTRACT FRAME DARI VIDEO ---
  const waitForSeek = async (video: HTMLVideoElement, time: number) => {
    return new Promise<void>((resolve) => {
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked);
        resolve();
      };
      video.addEventListener('seeked', onSeeked);
      video.currentTime = time;
    });
  };

  const extractFrames = async () => {
    if (file?.type.startsWith('video/') && videoRef.current) {
        const video = videoRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Canvas error");

        const originalTime = video.currentTime;
        const wasPaused = video.paused;
        if (!wasPaused) video.pause();

        const duration = video.duration || 10;
        const timePoints = [duration * 0.1, duration * 0.5, duration * 0.9];
        let frames = [];

        for (const time of timePoints) {
            const safeTime = Math.min(time, duration - 0.1); 
            await waitForSeek(video, safeTime);
            ctx.drawImage(video, 0, 0);
            frames.push(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
        }
        video.currentTime = originalTime;
        return frames;
    } else if (frameBase64) {
        return [frameBase64];
    }
    return [];
  };

  // --- LOGIC 2: CORE AI GENERATION ---
  const generateContent = async () => {
    setIsProcessing(true);
    setError(null);
    setGeneratedPrompt("");

    try {
      // Validasi API Key sebelum memulai
      if (!userApiKey.trim()) {
        throw new Error("Masukkan Google Gemini API Key Anda terlebih dahulu.");
      }

      let contentParts = [];

      // 1. Tentukan Input (Visual atau Teks)
      if (mode === 'visual') {
        const visuals = await extractFrames();
        if (visuals.length === 0) throw new Error("Tidak ada visual untuk dianalisis.");
        
        visuals.forEach(base64 => {
            contentParts.push({ inlineData: { mimeType: "image/jpeg", data: base64 } });
        });
        
        contentParts.push({
            text: `
            ROLE: Elite Video Prompt Reverse Engineer.
            TASK: Analyze the provided image(s) and deconstruct them into a HIGH-QUALITY JSON PROMPT for AI Video Generators (Sora, Hailuo, Runway).
            
            REQUIREMENTS:
            1. **Strict JSON Format**: Output ONLY a valid JSON object. No markdown text outside the JSON.
            2. **High Fidelity**: Use professional terminology (e.g., "anamorphic lens", "sub-surface scattering", "dynamic motion blur").
            3. **Density**: Do not use single words. Use descriptive phrases for values.

            JSON STRUCTURE TO POPULATE:
            {
              "subject_description": "Detailed description of character/object appearance, clothing, and textures",
              "action_and_movement": "Specific micro-movements and major actions happening over time",
              "environment_and_context": "Setting details, weather, time of day, and background elements",
              "camera_technique": "Camera gear, focal length, angles, and specific movements (pan, tilt, zoom)",
              "lighting_and_atmosphere": "Lighting setup (rim light, volumetric, etc.) and emotional mood",
              "technical_specs": "Resolution keywords (8k, photorealistic, unreal engine 5, etc.)",
              "negative_prompt": "What to avoid (e.g., distortion, bad anatomy, blur)"
            }
            `
        });

      } else {
        if (!textInput.trim()) throw new Error("Masukkan kata kunci terlebih dahulu.");
        
        contentParts.push({
            text: `
            ROLE: Creative AI Video Prompt Enhancer.
            TASK: Take the user's simple input: "${textInput}" and HALLUCINATE a masterpiece video scene around it. Expand it into a HIGH-QUALITY JSON PROMPT.
            
            REQUIREMENTS:
            1. **Expand & Enhance**: If user says "cat running", you create "A majestic Maine Coon cat sprinting through a neon-lit cyberpunk alleyway...".
            2. **Strict JSON Format**: Output ONLY a valid JSON object.
            3. **High Fidelity**: Inject professional video production keywords.

            JSON STRUCTURE TO POPULATE:
            {
              "subject_description": "Hyper-detailed description of the subject envisioned from the keyword",
              "action_and_movement": "Dynamic, fluid motion description extrapolated from the input",
              "environment_and_context": "Rich, immersive world building details",
              "camera_technique": "Cinematic camera choices (e.g., FPV drone, low angle dolly)",
              "lighting_and_atmosphere": "Atmospheric lighting description",
              "technical_specs": "Quality boosters (8k, masterpiece, trending on artstation, etc.)",
              "negative_prompt": "Common artifacts to avoid"
            }
            `
        });
      }

      // 2. Call API menggunakan Key dari User
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${userApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: contentParts }] })
        }
      );

      const data = await response.json();
      
      // Handle error spesifik dari API Google
      if (data.error) {
        if (data.error.message.includes("API key not valid")) {
            throw new Error("API Key tidak valid. Silakan periksa kembali.");
        }
        throw new Error(data.error.message);
      }

      let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();
      setGeneratedPrompt(text);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Terjadi kesalahan.");
    } finally {
      setIsProcessing(false);
    }
  };

  // --- HANDLERS ---
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
    setGeneratedPrompt("");
    
    if (selectedFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => setFrameBase64((reader.result as string).split(',')[1]);
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleClearFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFile(null);
    setPreviewUrl(null);
    setFrameBase64(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCopy = () => {
    const textToCopy = generatedPrompt;
    
    const onSuccess = () => {
      setCopyStatus(true);
      setTimeout(() => setCopyStatus(false), 2000);
    };

    const fallbackCopy = () => {
      try {
        const textArea = document.createElement("textarea");
        textArea.value = textToCopy;
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (successful) onSuccess();
        else setError("Gagal menyalin teks.");
      } catch (err) {
        setError("Gagal menyalin teks.");
      }
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textToCopy)
        .then(onSuccess)
        .catch(() => fallbackCopy());
    } else {
      fallbackCopy();
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 font-sans selection:bg-cyan-500 selection:text-white pb-20">
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[20%] w-[60%] h-[60%] bg-cyan-900/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-900/10 rounded-full blur-[150px]" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8 max-w-6xl">
        
        {/* Header */}
        <header className="flex items-center justify-between mb-8 border-b border-slate-800/60 pb-6">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center mr-4 shadow-lg shadow-cyan-500/20">
              <Braces className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                JSON Prompt Architect
              </h1>
              <p className="text-slate-500 text-xs tracking-wider uppercase font-semibold mt-1">
                AI Video Workflow Tool
              </p>
            </div>
          </div>
          <div className="hidden md:flex items-center space-x-2 text-xs font-mono text-slate-500 bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2"></span>
            Ready to Deploy
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* --- LEFT COLUMN: INPUT ZONE --- */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            
            {/* API KEY INPUT (NEW) */}
            <div className="bg-slate-900/80 border border-slate-700/60 rounded-xl p-4 shadow-lg">
                <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center">
                        <Key className="w-3 h-3 mr-1.5" />
                        Google Gemini API Key
                    </label>
                    <a 
                        href="https://aistudio.google.com/app/apikey" 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-[10px] text-slate-400 hover:text-white flex items-center transition-colors underline decoration-slate-700"
                    >
                        Dapatkan Key <ExternalLink className="w-2 h-2 ml-1" />
                    </a>
                </div>
                <input 
                    type="password"
                    value={userApiKey}
                    onChange={(e) => setUserApiKey(e.target.value)}
                    placeholder="Masukkan API Key (AI Studio) di sini..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm text-white placeholder-slate-600 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none transition-all font-mono"
                />
                <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
                    Key diperlukan untuk deployment publik. Data diproses langsung di browser Anda.
                </p>
            </div>

            {/* TABS SWITCHER */}
            <div className="bg-slate-900/50 p-1.5 rounded-xl flex border border-slate-800">
                <button 
                    onClick={() => setMode('visual')}
                    className={`flex-1 flex items-center justify-center py-2.5 text-sm font-medium rounded-lg transition-all ${mode === 'visual' ? 'bg-slate-800 text-cyan-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                >
                    <Upload className="w-4 h-4 mr-2" />
                    Analisis Visual
                </button>
                <button 
                    onClick={() => setMode('text')}
                    className={`flex-1 flex items-center justify-center py-2.5 text-sm font-medium rounded-lg transition-all ${mode === 'text' ? 'bg-slate-800 text-cyan-400 shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                >
                    <Type className="w-4 h-4 mr-2" />
                    Enhance Teks
                </button>
            </div>

            {/* CONTENT AREA */}
            <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-6 min-h-[300px] flex flex-col justify-center relative">
                
                {/* MODE 1: VISUAL UPLOAD */}
                {mode === 'visual' && (
                    <div 
                        className={`
                            flex-grow border-2 border-dashed rounded-xl transition-all relative flex flex-col items-center justify-center
                            ${file ? 'border-cyan-500/30 bg-slate-950' : 'border-slate-700 hover:border-cyan-500/40 hover:bg-slate-800/40 cursor-pointer'}
                        `}
                        onClick={() => !file && fileInputRef.current?.click()}
                    >
                        <input type="file" ref={fileInputRef} className="hidden" accept="video/*,image/*" onChange={handleFileChange} />
                        
                        {!file ? (
                            <div className="text-center p-8">
                                <div className="w-16 h-16 bg-slate-800/80 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-700">
                                    <Video className="w-7 h-7 text-cyan-400" />
                                </div>
                                <h3 className="text-slate-200 font-medium">Upload Media</h3>
                                <p className="text-slate-500 text-xs mt-2 max-w-[200px] mx-auto">
                                    Video (MP4) atau Gambar (JPG/PNG) untuk direkayasa balik menjadi JSON.
                                </p>
                            </div>
                        ) : (
                            <div className="relative w-full h-full p-2 group">
                                {file.type.startsWith('video/') ? (
                                    <video ref={videoRef} src={previewUrl!} className="w-full h-full object-contain rounded-lg" muted />
                                ) : (
                                    <img src={previewUrl!} alt="preview" className="w-full h-full object-contain rounded-lg" />
                                )}
                                <button 
                                    onClick={handleClearFile}
                                    className="absolute top-4 right-4 bg-red-500/90 text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-lg hover:scale-105"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                                <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur px-3 py-1 rounded text-xs border border-white/10 text-white">
                                    {file.name}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* MODE 2: TEXT INPUT */}
                {mode === 'text' && (
                    <div className="flex-grow w-full flex flex-col">
                        <label className="text-sm font-medium text-slate-400 mb-3 flex items-center">
                            <Sparkles className="w-4 h-4 mr-2 text-cyan-400" />
                            Ide Awal / Keywords
                        </label>
                        <textarea
                            value={textInput}
                            onChange={(e) => setTextInput(e.target.value)}
                            placeholder="Contoh: Kucing raksasa tidur di atas gedung pencakar langit saat hujan neon..."
                            className="flex-grow w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 resize-none font-mono text-sm leading-relaxed"
                        />
                    </div>
                )}
            </div>

            {/* GENERATE BUTTON */}
            <button
                onClick={generateContent}
                disabled={isProcessing || (mode === 'visual' && !file) || (mode === 'text' && !textInput) || !userApiKey}
                className={`
                    w-full py-4 rounded-xl font-bold text-base shadow-lg flex items-center justify-center transition-all border
                    ${isProcessing || !userApiKey
                        ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed' 
                        : 'bg-gradient-to-r from-cyan-600 to-blue-600 border-t-white/10 hover:shadow-cyan-500/25 hover:scale-[1.01] text-white'}
                `}
            >
                {isProcessing ? (
                    <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Processing...
                    </>
                ) : (
                    <>
                        <Wand2 className="w-5 h-5 mr-2" />
                        {mode === 'visual' ? 'Extract JSON Prompt' : 'Enhance to JSON'}
                    </>
                )}
            </button>
            
            {error && (
                <div className="bg-red-900/20 border border-red-500/20 text-red-300 px-4 py-3 rounded-xl text-sm flex items-center animate-in fade-in slide-in-from-top-2">
                    <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                    {error}
                </div>
            )}
          </div>

          {/* --- RIGHT COLUMN: JSON OUTPUT --- */}
          <div className="lg:col-span-7 flex flex-col h-full min-h-[500px]">
            <div className="bg-[#0f1522] border border-slate-800 rounded-2xl flex flex-col flex-grow shadow-2xl overflow-hidden ring-1 ring-white/5 relative">
                
                {/* Editor Header */}
                <div className="flex justify-between items-center px-5 py-4 border-b border-slate-800/50 bg-[#131b2c]">
                    <div className="flex items-center space-x-2">
                        <FileJson className="w-5 h-5 text-yellow-500" />
                        <span className="text-sm font-semibold text-slate-300">prompt_result.json</span>
                    </div>
                    
                    {generatedPrompt && (
                        <button
                            onClick={handleCopy}
                            className={`
                                flex items-center px-3 py-1.5 rounded-lg text-xs font-medium transition-all border
                                ${copyStatus 
                                    ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-700'}
                            `}
                        >
                            {copyStatus ? <Check className="w-3.5 h-3.5 mr-1.5" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
                            {copyStatus ? 'Copied' : 'Copy JSON'}
                        </button>
                    )}
                </div>

                {/* Editor Body */}
                <div className="flex-grow relative group overflow-hidden">
                    {generatedPrompt ? (
                        <div className="absolute inset-0 overflow-auto custom-scrollbar p-6">
                            <pre className="font-mono text-sm leading-relaxed text-blue-100/90 whitespace-pre-wrap">
                                {generatedPrompt}
                            </pre>
                        </div>
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-600">
                            <Layers className="w-12 h-12 mb-4 opacity-20" />
                            <p className="text-sm font-mono opacity-50">Menunggu input...</p>
                            <p className="text-xs opacity-30 mt-1 max-w-xs text-center">
                                JSON berkualitas tinggi akan muncul di sini setelah proses selesai.
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer Analysis */}
                {generatedPrompt && (
                    <div className="bg-slate-900/50 border-t border-slate-800/50 p-4">
                        <div className="flex items-start space-x-3">
                            <Info className="w-4 h-4 text-cyan-500 mt-1 flex-shrink-0" />
                            <p className="text-xs text-slate-400 leading-relaxed">
                                <span className="text-cyan-400 font-semibold">Quality Check:</span> JSON ini telah dioptimalkan dengan parameter teknis (Subject, Environment, Lighting, Camera) yang terpisah.
                            </p>
                        </div>
                    </div>
                )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}