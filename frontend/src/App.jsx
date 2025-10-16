import React, { useRef, useState, useEffect } from "react";
import Hls from "hls.js";
import axios from "axios";
import { Rnd } from "react-rnd";

function App() {
  const videoRef = useRef(null);
  const [hlsInstance, setHlsInstance] = useState(null);
  const [streamUrl, setStreamUrl] = useState("");
  const [overlays, setOverlays] = useState([]);
  const [form, setForm] = useState({
    type: "text",
    content: "",
    x: 50,
    y: 50,
    width: 100,
    height: 50,
  });
  const [editingId, setEditingId] = useState(null);
  const [videoSize, setVideoSize] = useState("medium");

  const API_BASE = "http://127.0.0.1:5000";

  const videoWidthMap = {
    small: 480,
    medium: 720,
    large: 1080,
  };

  // -----------------------------
  // API Operations
  // -----------------------------
  const fetchOverlays = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/overlays`);
      setOverlays(res.data);
    } catch (err) {
      console.error("Failed to fetch overlays:", err);
    }
  };

  const createOverlay = async () => {
    try {
      await axios.post(`${API_BASE}/api/overlays`, form);
      resetForm();
      fetchOverlays();
      setEditingId(null);
    } catch (err) {
      console.error("Create overlay failed:", err);
    }
  };

  const updateOverlayAPI = async () => {
    if (!editingId) return;
    try {
      await axios.put(`${API_BASE}/api/overlays/${editingId}`, form);
      setEditingId(null);
      resetForm();
      fetchOverlays();
    } catch (err) {
      console.error("Update overlay failed:", err);
    }
  };

  const deleteOverlay = async (id) => {
    try {
      await axios.delete(`${API_BASE}/api/overlays/${id}`);
      fetchOverlays();
    } catch (err) {
      console.error("Delete overlay failed:", err);
    }
  };

  const resetForm = () => {
    setForm({
      type: "text",
      content: "",
      x: 50,
      y: 50,
      width: 100,
      height: 50,
    });
    setEditingId(null);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axios.post(`${API_BASE}/api/upload`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const imageUrl = res.data.url;
      setForm({ ...form, content: imageUrl, type: "image" });
    } catch (err) {
      console.error("Image upload failed:", err);
    }
  };

  // -----------------------------
  // HLS Setup
  // -----------------------------
  useEffect(() => {
    fetchOverlays();
  }, []);

  useEffect(() => {
    if (!streamUrl || !videoRef.current) return;

    if (hlsInstance) {
      hlsInstance.destroy();
      setHlsInstance(null);
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        liveSyncDurationCount: 1,
        maxBufferLength: 5,
        maxMaxBufferLength: 10,
        backBufferLength: 0,
        enableWorker: true,
        lowLatencyMode: true,
      });

      hls.loadSource(streamUrl);
      hls.attachMedia(videoRef.current);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        videoRef.current.play().catch((e) => console.log("Autoplay error:", e));
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        console.error("HLS.js error:", data);
      });

      setHlsInstance(hls);

      return () => hls.destroy();
    } else if (videoRef.current.canPlayType("application/vnd.apple.mpegurl")) {
      videoRef.current.src = streamUrl;
      videoRef.current.play().catch((e) => console.log("Autoplay error:", e));
    }
  }, [streamUrl]);

  // -----------------------------
  // UI Handlers
  // -----------------------------
  const handleEdit = (overlay) => {
    setForm({
      type: overlay.type,
      content: overlay.content,
      x: overlay.x,
      y: overlay.y,
      width: overlay.width,
      height: overlay.height,
    });
    setEditingId(overlay._id);
  };

  const updateOverlay = (id, newProps) => {
    setOverlays(overlays.map((o) => (o._id === id ? { ...o, ...newProps } : o)));
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>HLS Livestream + Overlay Manager</h1>

      {/* Stream URL Input */}
      <h2>Stream URL</h2>
      <input
        type="text"
        placeholder="Enter HLS URL"
        value={streamUrl}
        onChange={(e) => setStreamUrl(e.target.value)}
        style={{ width: "60%", marginBottom: "20px" }}
      />

      {/* Screen Size Selector */}
      <div style={{ marginBottom: "20px" }}>
        <label>Select Screen Size: </label>
        <select value={videoSize} onChange={(e) => setVideoSize(e.target.value)}>
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
        </select>
      </div>

      {/* Video + Overlays */}
      <h2>Video Preview</h2>
      <div
        style={{
          position: "relative",
          width: videoWidthMap[videoSize],
          height: videoWidthMap[videoSize] * 0.5625, // 16:9 ratio
          marginBottom: "20px",
        }}
      >
        <video
          ref={videoRef}
          controls
          autoPlay
          muted
          playsInline
          width={videoWidthMap[videoSize]}
          style={{ borderRadius: "10px", backgroundColor: "#000" }}
        />
        {overlays.map((ov) => (
          <Rnd
            key={ov._id}
            size={{ width: ov.width, height: ov.height }}
            position={{ x: ov.x, y: ov.y }}
            bounds="parent"
            onDragStop={(e, d) => updateOverlay(ov._id, { x: d.x, y: d.y })}
            onResizeStop={(e, dir, ref, delta, pos) =>
              updateOverlay(ov._id, {
                width: parseInt(ref.style.width),
                height: parseInt(ref.style.height),
                ...pos,
              })
            }
          >
            {ov.type === "text" ? (
              <div
                style={{
                  color: "red",
                  backgroundColor: "rgba(0,0,0,0.4)",
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  pointerEvents: "none",
                }}
              >
                {ov.content}
              </div>
            ) : (
              <img
                src={ov.content}
                alt=""
                style={{ width: "100%", height: "100%", pointerEvents: "none" }}
              />
            )}
          </Rnd>
        ))}
      </div>

      {/* Overlay Controls / Form */}
      <h2>Overlay Controls</h2>
      <div style={{ marginBottom: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
        <label>
          Type:
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            style={{ marginLeft: "10px" }}
          >
            <option value="text">Text</option>
            <option value="image">Image</option>
          </select>
        </label>

        {form.type === "text" ? (
          <label>
            Content:
            <input
              type="text"
              placeholder="Enter text"
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              style={{ marginLeft: "10px" }}
            />
          </label>
        ) : (
          <label>
            Image Upload:
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              style={{ marginLeft: "10px" }}
            />
          </label>
        )}

        <label>
          X:
          <input
            type="number"
            value={form.x}
            onChange={(e) => setForm({ ...form, x: parseInt(e.target.value) })}
            style={{ marginLeft: "10px", width: "60px" }}
          />
        </label>

        <label>
          Y:
          <input
            type="number"
            value={form.y}
            onChange={(e) => setForm({ ...form, y: parseInt(e.target.value) })}
            style={{ marginLeft: "10px", width: "60px" }}
          />
        </label>

        <label>
          Width:
          <input
            type="number"
            value={form.width}
            onChange={(e) => setForm({ ...form, width: parseInt(e.target.value) })}
            style={{ marginLeft: "10px", width: "60px" }}
          />
        </label>

        <label>
          Height:
          <input
            type="number"
            value={form.height}
            onChange={(e) => setForm({ ...form, height: parseInt(e.target.value) })}
            style={{ marginLeft: "10px", width: "60px" }}
          />
        </label>

        <div>
          {editingId ? (
            <>
              <button onClick={updateOverlayAPI}>Update</button>
              <button onClick={resetForm} style={{ marginLeft: "10px" }}>
                Cancel
              </button>
            </>
          ) : (
            <button onClick={createOverlay}>Create</button>
          )}
        </div>
      </div>

      {/* Existing overlays list */}
      <h2>Existing Overlays</h2>
      <ul style={{ listStyle: "none", paddingLeft: 0 }}>
        {overlays.map((o) => (
          <li
            key={o._id}
            style={{
              marginBottom: "8px",
              border: "1px solid #ccc",
              padding: "6px",
              borderRadius: "4px",
            }}
          >
            <strong>{o.type}</strong> - {o.type === "text" ? o.content : <img src={o.content} alt="" style={{ maxHeight: "30px" }} />}
            <br />
            Position: ({o.x}, {o.y}), Size: {o.width}x{o.height}
            <br />
            <button onClick={() => handleEdit(o)}>Edit</button>
            <button onClick={() => deleteOverlay(o._id)} style={{ marginLeft: "10px" }}>
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
