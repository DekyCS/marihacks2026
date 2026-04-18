"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { FileText, ChevronRight, Loader2, Plus, Sun, Moon } from 'lucide-react';
import { fetchManuals, uploadPDF, processManual } from '@/lib/api';

interface Project {
  id: string;
  title: string;
}

export default function Dashboard() {
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState('');
  const [isDark, setIsDark] = useState(true);
  const [typedWord, setTypedWord] = useState('');
  const [wordIndex, setWordIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  const words = ['IKEA', 'electronics', 'furniture', 'appliances', 'cars', 'machines'];

  useEffect(() => {
    const currentWord = words[wordIndex];
    const typeSpeed = isDeleting ? 50 : 100;
    const pauseTime = 2000;

    const timeout = setTimeout(() => {
      if (!isDeleting) {
        if (typedWord.length < currentWord.length) {
          setTypedWord(currentWord.slice(0, typedWord.length + 1));
        } else {
          setTimeout(() => setIsDeleting(true), pauseTime);
        }
      } else {
        if (typedWord.length > 0) {
          setTypedWord(typedWord.slice(0, -1));
        } else {
          setIsDeleting(false);
          setWordIndex((prev) => (prev + 1) % words.length);
        }
      }
    }, typeSpeed);

    return () => clearTimeout(timeout);
  }, [typedWord, isDeleting, wordIndex]);

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved) {
      setIsDark(saved === 'dark');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  useEffect(() => {
    loadManuals();
  }, []);

  async function loadManuals() {
    try {
      setIsLoading(true);
      const manuals = await fetchManuals();
      const loadedProjects: Project[] = manuals.map((manual) => ({
        id: manual.hash,
        title: manual.filename.replace('.pdf', ''),
      }));
      setProjects(loadedProjects);
      setError(null);
    } catch {
      setError('Failed to load projects. Make sure the backend server is running.');
    } finally {
      setIsLoading(false);
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    setIsUploading(true);
    setIsProcessing(false);
    setError(null);
    setUploadProgress('Uploading PDF...');

    try {
      const uploadResult = await uploadPDF(file);
      setUploadProgress('Processing manual...');
      setIsUploading(false);
      setIsProcessing(true);

      await processManual(uploadResult.pdf_hash);
      setUploadProgress('Complete!');
      await loadManuals();

      setTimeout(() => {
        setIsProcessing(false);
        setUploadProgress('');
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setIsUploading(false);
      setIsProcessing(false);
      setUploadProgress('');
    }

    e.target.value = '';
  };

  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 ${
      isDark ? 'bg-zinc-900 text-white' : 'bg-zinc-50 text-zinc-900'
    }`}>

      <header className="h-20 flex items-center justify-center px-6">
        <div
          className="rounded-[2rem] h-12 flex items-center justify-between px-8 w-full max-w-2xl relative"
          style={{
            background: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.7)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            border: isDark ? '1px solid rgba(255, 255, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.8)',
            boxShadow: isDark
              ? '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
              : '0 8px 32px rgba(31, 38, 135, 0.15), inset 0 2px 20px rgba(255, 255, 255, 0.5)',
          }}
        >
          <span className={`font-bold text-lg tracking-tight ${isDark ? 'text-white' : 'text-zinc-800'}`}>ManualY</span>
          <button
            onClick={() => setIsDark(!isDark)}
            className={`p-2 rounded-full transition-all ${
              isDark
                ? 'hover:bg-white/10 text-zinc-300 hover:text-white'
                : 'hover:bg-black/10 text-zinc-700 hover:text-black'
            }`}
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
      </header>

      <main className="px-[20%] py-12">

        <div className="mb-24 text-center flex flex-col items-center justify-center min-h-[40vh]">
          <h1 className={`text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight whitespace-nowrap ${
            isDark ? 'text-white' : 'text-zinc-900'
          }`}>
            Better manuals for <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-purple-600">{typedWord}</span><span className="animate-pulse text-purple-400">|</span>
          </h1>
          <p className={`text-xl max-w-2xl mx-auto ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
            Drop your manuals. Watch them transform into interactive 3D guides with voice navigation.
          </p>
          {error && (
            <div className={`mt-4 p-3 rounded-xl text-sm border ${
              isDark
                ? 'glass-navbar light-glass-navbar text-red-400 border-red-500/20'
                : 'bg-red-50 text-red-600 border-red-200'
            }`}>
              {error}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

          {/* Upload Card */}
          <div className={`relative group h-48 rounded-2xl border border-dashed transition-all cursor-pointer flex flex-col items-center justify-center ${
            isDark
              ? 'border-zinc-700 hover:border-purple-500'
              : 'border-zinc-300 hover:border-purple-500 hover:bg-purple-50/30'
          }`}>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              disabled={isUploading || isProcessing}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />

            {(isUploading || isProcessing) ? (
              <div className="flex flex-col items-center">
                <Loader2 className="w-8 h-8 text-purple-500 animate-spin mb-3" />
                <span className={`text-sm ${isDark ? 'text-white' : 'text-zinc-900'}`}>{uploadProgress}</span>
                <span className={`text-xs mt-1 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
                  {isUploading ? 'Uploading...' : 'Generating 3D Assets'}
                </span>
              </div>
            ) : (
              <>
                <div className={`w-10 h-10 rounded-full border flex items-center justify-center mb-3 group-hover:border-purple-500 group-hover:text-purple-500 transition-all ${
                  isDark ? 'border-zinc-600 text-zinc-400' : 'border-zinc-300 text-zinc-500'
                }`}>
                  <Plus className="w-5 h-5" />
                </div>
                <span className={`text-sm group-hover:text-purple-500 transition-colors ${
                  isDark ? 'text-zinc-300' : 'text-zinc-700'
                }`}>Upload Manual</span>
                <span className={`text-xs mt-1 ${isDark ? 'text-zinc-600' : 'text-zinc-400'}`}>PDF files only</span>
              </>
            )}
          </div>

          {/* Loading State */}
          {isLoading && !isUploading && !isProcessing && (
            <div className="col-span-full flex justify-center items-center py-8">
              <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
              <span className={`ml-2 text-sm ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>Loading...</span>
            </div>
          )}

          {/* Project Cards */}
          {!isLoading && projects.map((project) => (
            <Link key={project.id} href={`/workspace/${project.id}`} className="group block">
              <div className={`h-48 rounded-2xl border transition-all flex flex-col overflow-hidden ${
                isDark
                  ? 'border-zinc-800 hover:border-zinc-600'
                  : 'border-zinc-200 hover:border-zinc-300 hover:shadow-lg'
              }`}>
                <div className={`flex-1 flex items-center justify-center ${
                  isDark ? 'bg-zinc-800/50' : 'bg-zinc-100'
                }`}>
                  <FileText className={`w-10 h-10 group-hover:text-purple-500 transition-colors ${
                    isDark ? 'text-zinc-600' : 'text-zinc-400'
                  }`} />
                </div>
                <div className={`p-4 border-t ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium truncate group-hover:text-purple-500 transition-colors ${
                      isDark ? 'text-white' : 'text-zinc-900'
                    }`}>
                      {project.title}
                    </span>
                    <ChevronRight className={`w-4 h-4 group-hover:text-purple-500 group-hover:translate-x-0.5 transition-all ${
                      isDark ? 'text-zinc-600' : 'text-zinc-400'
                    }`} />
                  </div>
                </div>
              </div>
            </Link>
          ))}

        </div>
      </main>
    </div>
  );
}
