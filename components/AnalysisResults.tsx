import React, { useEffect, useState } from 'react';
import { Play, CheckCircle, AlertTriangle, Users, MessageCircle, RefreshCcw, Star, TrendingUp } from 'lucide-react';
import { AnalysisResult, HackathonData } from '../types';
import { analyzeVideoDemo } from '../services/geminiService';

interface Props {
  videoBlob: Blob;
  hackathonData: HackathonData;
  onRetry: () => void;
}

const AnalysisResults: React.FC<Props> = ({ videoBlob, hackathonData, onRetry }) => {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [videoUrl, setVideoUrl] = useState<string>('');

  useEffect(() => {
    const url = URL.createObjectURL(videoBlob);
    setVideoUrl(url);

    const runAnalysis = async () => {
      try {
        const analysis = await analyzeVideoDemo(videoBlob, hackathonData);
        setResult(analysis);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    runAnalysis();

    return () => URL.revokeObjectURL(url);
  }, [videoBlob, hackathonData]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 space-y-8">
        <div className="relative">
             <div className="w-24 h-24 rounded-full border-4 border-stone-200"></div>
             <div className="absolute top-0 left-0 w-24 h-24 rounded-full border-4 border-rose-400 border-t-transparent animate-spin"></div>
        </div>
        <div className="text-center space-y-2">
            <h2 className="text-3xl font-serif text-stone-900">Gathering feedback...</h2>
            <p className="text-stone-500 font-hand text-xl">Reviewing judge profiles against your demo.</p>
        </div>
      </div>
    );
  }

  if (!result) return <div>Error loading results.</div>;

  return (
    <div className="min-h-screen bg-stone-50 p-6 md:p-12 max-w-7xl mx-auto">
      <header className="flex justify-between items-center mb-12">
        <div>
             <h1 className="text-4xl font-bold text-stone-900 font-serif mb-2">The Verdict</h1>
             <p className="text-stone-500">Based on <span className="font-semibold text-stone-700">{hackathonData.judges.length} judge profiles</span></p>
        </div>
        <button onClick={onRetry} className="group flex items-center gap-2 text-stone-500 hover:text-stone-900 transition-colors px-4 py-2 rounded-full hover:bg-white hover:shadow-sm">
            <RefreshCcw className="w-4 h-4 group-hover:-rotate-180 transition-transform duration-500" />
            <span className="font-medium">Record Again</span>
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Col: Video & Score */}
        <div className="lg:col-span-5 space-y-8">
             <div className="bg-white p-2 rounded-3xl shadow-lg shadow-stone-200 border border-stone-100">
                <div className="rounded-2xl overflow-hidden bg-stone-900 aspect-video relative">
                    <video src={videoUrl} controls className="w-full h-full object-cover" />
                </div>
            </div>

            <div className="bg-white rounded-3xl p-8 border border-stone-100 shadow-sm relative overflow-hidden group">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-rose-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110"></div>
                 
                 <div className="relative z-10 flex flex-col items-center text-center">
                    <span className="text-stone-400 uppercase tracking-widest text-xs font-bold mb-4">Overall Impact</span>
                    <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-8xl font-serif text-stone-900 tracking-tighter">{result.overallScore}</span>
                        <span className="text-2xl text-stone-400 font-serif">/100</span>
                    </div>
                    
                    <div className="flex gap-1 mb-6">
                        {[1,2,3,4,5].map((s) => (
                             <Star key={s} className={`w-6 h-6 ${s <= Math.round(result.overallScore/20) ? 'fill-amber-400 text-amber-400' : 'fill-stone-100 text-stone-200'}`} />
                        ))}
                    </div>

                    <div className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-bold ${result.overallScore > 80 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                        {result.overallScore > 80 ? 'Finals Material 🚀' : 'Needs Refining 🛠️'}
                    </div>
                 </div>
            </div>
        </div>

        {/* Right Col: Feedback */}
        <div className="lg:col-span-7 space-y-8">
            
            {/* Strengths & Weaknesses Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-emerald-50/50 p-8 rounded-3xl border border-emerald-100/50 hover:bg-emerald-50 transition-colors">
                    <h3 className="text-emerald-900 font-bold mb-6 flex items-center gap-2 font-serif text-lg">
                        <CheckCircle className="w-5 h-5 text-emerald-600" /> Shining Moments
                    </h3>
                    <ul className="space-y-4">
                        {result.strengths.map((s, i) => (
                            <li key={i} className="text-emerald-900/80 text-sm leading-relaxed flex items-start">
                                <span className="mr-3 mt-1.5 w-1.5 h-1.5 bg-emerald-400 rounded-full shrink-0"></span> 
                                {s}
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="bg-rose-50/50 p-8 rounded-3xl border border-rose-100/50 hover:bg-rose-50 transition-colors">
                    <h3 className="text-rose-900 font-bold mb-6 flex items-center gap-2 font-serif text-lg">
                        <TrendingUp className="w-5 h-5 text-rose-600" /> Polish This
                    </h3>
                    <ul className="space-y-4">
                        {result.improvements.map((s, i) => (
                            <li key={i} className="text-rose-900/80 text-sm leading-relaxed flex items-start">
                                <span className="mr-3 mt-1.5 w-1.5 h-1.5 bg-rose-400 rounded-full shrink-0"></span> 
                                {s}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* Judge Feedback - Note Style */}
            <div className="bg-white border border-stone-200 rounded-3xl p-8 shadow-sm relative">
                 {/* Tape effect */}
                 <div className="absolute top-0 left-1/2 -ml-8 -mt-3 w-16 h-8 bg-stone-100/80 rotate-1 shadow-sm backdrop-blur-sm"></div>

                <h3 className="text-stone-900 font-bold mb-8 flex items-center gap-2 font-serif text-xl">
                    <Users className="w-6 h-6 text-stone-400" /> Judge Notes
                </h3>
                <div className="space-y-6">
                    {result.judgeSpecificFeedback.map((item, i) => (
                        <div key={i} className="flex gap-4 group">
                             <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center shrink-0 font-serif font-bold text-stone-500 group-hover:bg-stone-900 group-hover:text-white transition-colors">
                                 {item.judgeName.charAt(0)}
                             </div>
                             <div>
                                <div className="text-stone-900 font-bold text-sm mb-1">{item.judgeName}</div>
                                <p className="text-stone-500 font-hand text-lg leading-relaxed">"{item.feedback}"</p>
                             </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Q&A Prep */}
            <div className="bg-indigo-50/30 border border-indigo-100/50 rounded-3xl p-8">
                <h3 className="text-indigo-900 font-bold mb-6 flex items-center gap-2 font-serif text-xl">
                    <MessageCircle className="w-6 h-6 text-indigo-400" /> Prep for Q&A
                </h3>
                <div className="space-y-4">
                    {result.qaQuestions.map((q, i) => (
                        <div key={i} className="bg-white p-4 rounded-2xl border border-indigo-100 shadow-sm flex gap-4 items-start">
                            <span className="bg-indigo-100 text-indigo-600 font-bold px-2 py-1 rounded text-xs mt-0.5">Q{i+1}</span>
                            <p className="text-stone-700 font-medium">{q.question}</p>
                        </div>
                    ))}
                </div>
            </div>

        </div>
      </div>
    </div>
  );
};

export default AnalysisResults;