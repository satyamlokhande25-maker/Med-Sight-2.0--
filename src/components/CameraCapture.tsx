import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, RefreshCw, Check, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface CameraCaptureProps {
  onCapture: (base64Image: string) => void;
  onClose: () => void;
  title?: string;
}

export function CameraCapture({ onCapture, onClose, title = "Capture Photo" }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, 
        audio: false 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        setIsCameraReady(true);
      }
    } catch (err: any) {
      console.error("Error accessing camera:", err);
      setError("Could not access camera. Please ensure permissions are granted.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        setCapturedImage(dataUrl);
        stopCamera();
      }
    }
  };

  const retake = () => {
    setCapturedImage(null);
    startCamera();
  };

  const confirm = () => {
    if (capturedImage) {
      onCapture(capturedImage);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-zinc-900 border border-zinc-800 rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl"
      >
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="text-xl font-bold text-zinc-100">{title}</h3>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-xl text-zinc-500 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="relative aspect-video bg-black flex items-center justify-center">
          {error ? (
            <div className="text-center p-8 space-y-4">
              <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500 mx-auto">
                <AlertCircle size={32} />
              </div>
              <p className="text-zinc-400 max-w-xs mx-auto">{error}</p>
              <button 
                onClick={startCamera}
                className="px-6 py-2 bg-zinc-800 text-zinc-100 rounded-xl font-bold hover:bg-zinc-700 transition-all"
              >
                Try Again
              </button>
            </div>
          ) : capturedImage ? (
            <img src={capturedImage} alt="Captured" className="w-full h-full object-contain" />
          ) : (
            <>
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                className="w-full h-full object-cover"
              />
              {!isCameraReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                  <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </>
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        <div className="p-8 flex items-center justify-center gap-4">
          {capturedImage ? (
            <>
              <button 
                onClick={retake}
                className="flex-1 py-4 bg-zinc-800 text-zinc-100 rounded-2xl font-bold hover:bg-zinc-700 transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw size={20} />
                Retake
              </button>
              <button 
                onClick={confirm}
                className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-bold hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20"
              >
                <Check size={20} />
                Use Photo
              </button>
            </>
          ) : (
            <button 
              onClick={takePhoto}
              disabled={!isCameraReady}
              className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-zinc-950 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 shadow-2xl"
            >
              <Camera size={32} />
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
