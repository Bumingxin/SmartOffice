#!/usr/bin/env python3
import json
import os
import sys

backend = None
text = ""
errors = []

if len(sys.argv) < 2:
    print(json.dumps({"ok": False, "error": "Usage: transcribe_audio.py <audio_file> [model]"}, ensure_ascii=False))
    sys.exit(2)

file_path = sys.argv[1]
model_name = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] else "base"
device = "cpu"
compute_type = "int8"
cpu_threads = max(1, (os.cpu_count() or 4) - 1)

try:
    import ctranslate2
    if getattr(ctranslate2, "get_cuda_device_count", lambda: 0)() > 0:
        device = "cuda"
        compute_type = "float16"
except Exception:
    pass

try:
    from faster_whisper import WhisperModel
    model_kwargs = {"device": device, "compute_type": compute_type}
    if device == "cpu":
        model_kwargs["cpu_threads"] = cpu_threads
    model = WhisperModel(model_name, **model_kwargs)
    segments, _ = model.transcribe(file_path, vad_filter=True)
    text = " ".join((segment.text or "").strip() for segment in segments if (segment.text or "").strip()).strip()
    backend = "faster_whisper"
except Exception as exc:
    errors.append(f"faster_whisper: {exc}")

if backend is None:
    try:
        import whisper
        model = whisper.load_model(model_name)
        result = model.transcribe(file_path, fp16=False)
        text = (result.get("text") or "").strip()
        backend = "whisper"
    except Exception as exc:
        errors.append(f"whisper: {exc}")

ok = bool(backend and text)
print(json.dumps({
    "ok": ok,
    "provider": backend,
    "text": text,
    "error": "; ".join(errors)
}, ensure_ascii=False))
sys.exit(0 if ok else 3)
