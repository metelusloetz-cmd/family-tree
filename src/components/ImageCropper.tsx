import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Cropper from 'react-easy-crop';

/**
 * ImageCropper — fullscreen modal via Portal.
 * Rendered outside React Flow to avoid clipping.
 * Aspect 5:6, output 200×240 JPEG.
 */

const PHOTO_W = 200;
const PHOTO_H = 240;
const ASPECT = PHOTO_W / PHOTO_H;

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.crossOrigin = 'anonymous';
    img.src = url;
  });

async function getCroppedBase64(
  imageSrc: string,
  crop: { x: number; y: number; width: number; height: number },
): Promise<string> {
  const img = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = PHOTO_W;
  canvas.height = PHOTO_H;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, crop.x, crop.y, crop.width, crop.height, 0, 0, PHOTO_W, PHOTO_H);
  return canvas.toDataURL('image/jpeg', 0.85);
}

interface ImageCropperProps {
  imageFile: File;
  onCrop: (base64: string) => void;
  onCancel: () => void;
}

export const ImageCropper = ({ imageFile, onCrop, onCancel }: ImageCropperProps) => {
  const [imageSrc, setImageSrc] = useState<string>('');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedPixels, setCroppedPixels] = useState<any>(null);

  useEffect(() => {
    const reader = new FileReader();
    reader.onload = () => setImageSrc(reader.result as string);
    reader.readAsDataURL(imageFile);
  }, [imageFile]);

  const onCropComplete = useCallback((_: any, pixels: any) => {
    setCroppedPixels(pixels);
  }, []);

  const handleSave = async () => {
    if (!croppedPixels || !imageSrc) return;
    try {
      const base64 = await getCroppedBase64(imageSrc, croppedPixels);
      onCrop(base64);
    } catch (e) {
      console.error('Crop error:', e);
    }
  };

  if (!imageSrc) return null;

  // Portal to body — avoids React Flow clipping
  return createPortal(
    <div
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      onDoubleClick={e => e.stopPropagation()}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(15,23,42,0.92)',
        backdropFilter: 'blur(12px)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-family)',
      }}
    >
      {/* Title */}
      <div style={{
        color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 400,
        letterSpacing: 0.5, marginBottom: 16,
      }}>
        Выберите область
      </div>

      {/* Crop area */}
      <div style={{
        position: 'relative',
        width: Math.min(300, window.innerWidth - 48),
        height: Math.min(360, window.innerHeight - 200),
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: '0 8px 40px rgba(0,0,0,0.3)',
      }}>
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={ASPECT}
          onCropChange={setCrop}
          onCropComplete={onCropComplete}
          onZoomChange={setZoom}
          cropShape="rect"
          showGrid={false}
          style={{
            containerStyle: { borderRadius: 16 },
            cropAreaStyle: {
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 8,
            },
          }}
        />
      </div>

      {/* Zoom slider */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        marginTop: 20, color: 'rgba(255,255,255,0.4)', fontSize: 11,
      }}>
        <span>−</span>
        <input
          type="range"
          min={1} max={3} step={0.05}
          value={zoom}
          onChange={e => setZoom(Number(e.target.value))}
          style={{ width: 140, accentColor: '#818cf8', opacity: 0.8 }}
        />
        <span>+</span>
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
        <button onClick={onCancel} style={{
          padding: '10px 28px', borderRadius: 24,
          border: '1px solid rgba(255,255,255,0.15)',
          background: 'rgba(255,255,255,0.06)',
          color: 'rgba(255,255,255,0.7)',
          fontSize: 13, fontWeight: 500, cursor: 'pointer',
          fontFamily: 'var(--font-family)',
          transition: 'background 0.2s',
        }}>
          Отмена
        </button>
        <button onClick={handleSave} style={{
          padding: '10px 28px', borderRadius: 24,
          border: 'none',
          background: '#818cf8', color: '#fff',
          fontSize: 13, fontWeight: 500, cursor: 'pointer',
          fontFamily: 'var(--font-family)',
          boxShadow: '0 4px 16px rgba(129,140,248,0.3)',
          transition: 'background 0.2s',
        }}>
          Применить
        </button>
      </div>
    </div>,
    document.body,
  );
};
