"use client";

import { useEffect, useState } from "react";
import { mockCameras } from "@/lib/mock-data";
import { cn, getStatusColor } from "@/lib/utils";
import { Camera, Circle, Maximize2, Volume2 } from "lucide-react";
import { api } from "@/lib/api";

interface CameraGridProps {
  columns?: 2 | 3 | 4;
  limit?: number;
}

export default function CameraGrid({ columns = 3, limit }: CameraGridProps) {
  const [cameras, setCameras] = useState<any[]>([]);

  useEffect(() => {
    api
      .getCameras()
      .then((data) => setCameras(limit ? data.slice(0, limit) : data))
      .catch(() => setCameras(limit ? mockCameras.slice(0, limit) : mockCameras));
  }, [limit]);

  return (
    <div
      className={cn(
        "grid gap-3",
        columns === 2 && "grid-cols-1 md:grid-cols-2",
        columns === 3 && "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
        columns === 4 && "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      )}
    >
      {cameras.map((camera) => (
        <div
          key={camera.id}
          className="group relative overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 transition-all duration-200 hover:border-slate-700"
        >
          <div className="camera-feed-placeholder aspect-video">
            <div className="relative z-10 flex h-full flex-col items-center justify-center gap-2">
              {camera.status === "ONLINE" ? (
                <>
                  <Camera className="h-8 w-8 text-slate-600" />
                  <span className="text-xs text-slate-600">Live Feed</span>
                  <div className="absolute left-3 top-3 flex items-center gap-1.5">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">
                      Live
                    </span>
                  </div>
                </>
              ) : camera.status === "OFFLINE" ? (
                <>
                  <Camera className="h-8 w-8 text-red-900" />
                  <span className="text-xs font-medium text-red-500">Camera Offline</span>
                </>
              ) : (
                <>
                  <Camera className="h-8 w-8 text-amber-900" />
                  <span className="text-xs font-medium text-amber-500">Maintenance</span>
                </>
              )}
            </div>

            <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent p-3 pt-8">
              <div>
                <p className="text-xs font-medium text-white">{camera.name}</p>
                <p className="text-[10px] text-slate-400">{camera.location}</p>
              </div>
              <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button className="flex h-7 w-7 items-center justify-center rounded-md bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20">
                  <Volume2 className="h-3.5 w-3.5" />
                </button>
                <button className="flex h-7 w-7 items-center justify-center rounded-md bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20">
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-1.5">
              <Circle
                className={cn(
                  "h-2 w-2 fill-current",
                  camera.status === "ONLINE"
                    ? "text-emerald-400"
                    : camera.status === "OFFLINE"
                    ? "text-red-400"
                    : "text-amber-400"
                )}
              />
              <span className={cn("text-xs font-medium", getStatusColor(camera.status))}>
                {camera.status}
              </span>
            </div>
            <span className="text-[10px] text-slate-600">{camera.id.toUpperCase()}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
