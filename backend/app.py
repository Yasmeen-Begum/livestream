from flask import Flask, request, jsonify, send_from_directory
from flask_pymongo import PyMongo
from flask_cors import CORS
from bson.objectid import ObjectId
import time
import os
from werkzeug.utils import secure_filename

app = Flask(__name__)
CORS(app)

# MongoDB setup
app.config['MONGO_URI'] = 'mongodb://localhost:27017/rstp_db'
mongo = PyMongo(app)

# Upload folder for images
UPLOAD_FOLDER = './uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# ------------------------------
# Overlay CRUD APIs
# ------------------------------
@app.route('/api/overlays', methods=['POST'])
def create_overlay():
    payload = request.json
    overlay = {
        "type": payload.get("type", "text"),
        "content": payload.get("content", ""),
        "x": payload.get("x", 50),
        "y": payload.get("y", 50),
        "width": payload.get("width", 100),
        "height": payload.get("height", 50),
        "createdAt": time.time()
    }
    res = mongo.db.overlays.insert_one(overlay)
    overlay["_id"] = str(res.inserted_id)
    return jsonify(overlay), 201


@app.route('/api/overlays', methods=['GET'])
def list_overlays():
    overlays = []
    for o in mongo.db.overlays.find():
        o['_id'] = str(o['_id'])
        overlays.append(o)
    return jsonify(overlays), 200


@app.route('/api/overlays/<overlay_id>', methods=['PUT'])
def update_overlay(overlay_id):
    data = request.json
    allowed_fields = {"type", "content", "x", "y", "width", "height"}
    update_data = {k: v for k, v in data.items() if k in allowed_fields}
    mongo.db.overlays.update_one({'_id': ObjectId(overlay_id)}, {'$set': update_data})
    return jsonify({'status': 'updated'}), 200


@app.route('/api/overlays/<overlay_id>', methods=['DELETE'])
def delete_overlay(overlay_id):
    mongo.db.overlays.delete_one({'_id': ObjectId(overlay_id)})
    return jsonify({'status': 'deleted'}), 200


# ------------------------------
# Image upload API
# ------------------------------
@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    filename = secure_filename(file.filename)
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)
    # Return URL accessible by frontend
    url = f"http://127.0.0.1:5000/uploads/{filename}"
    return jsonify({'url': url}), 200


# Serve uploaded files
@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


# ------------------------------
# Run Server
# ------------------------------
if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5000, debug=True)
