import json, os, boto3
from flask import Flask, request, Response, stream_with_context

app = Flask(__name__)
bedrock = boto3.client('bedrock-runtime', region_name='ap-southeast-5')
MODEL_ID = 'global.anthropic.claude-haiku-4-5-20251001-v1:0'

SYSTEM_PROMPT = "Act as an interactive quiz tutor based on the uploaded lecture notes. When the user types 'start', ask 5 multiple-choice questions (with options A, B, C, D) one at a time. Wait for the user's response after each question. Give immediate feedback on whether their answer is correct or incorrect, provide a short explanation referencing the notes, and then present the next question."

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
}

@app.route('/', methods=['OPTIONS'])
def options():
    return Response('', status=200, headers=CORS_HEADERS)

@app.route('/', methods=['POST'])
def handler():
    body = request.get_json(force=True)
    file_data = body.get('file_data')
    file_mime = body.get('file_mime', '')
    history = body.get('history', [])
    message = body.get('message', '')

    messages = []

    # Build first user message with document if provided
    if file_data and (not history or history[0].get('role') != 'user'):
        doc_content = []
        if file_mime.startswith('image/'):
            img_fmt = file_mime.split('/')[-1]
            if img_fmt == 'jpg': img_fmt = 'jpeg'
            doc_content.append({
                'type': 'image',
                'source': {'type': 'base64', 'media_type': file_mime, 'data': file_data}
            })
        else:
            doc_content.append({
                'type': 'document',
                'source': {'type': 'base64', 'media_type': file_mime, 'data': file_data}
            })
        doc_content.append({'type': 'text', 'text': 'These are the lecture notes for this session.'})
        messages.append({'role': 'user', 'content': doc_content})
        messages.append({'role': 'assistant', 'content': 'I have reviewed the lecture notes. Type "start" to begin the quiz!'})

    # Append conversation history
    for turn in history:
        messages.append({'role': turn['role'], 'content': turn['content']})

    # Append the new user message
    messages.append({'role': 'user', 'content': message})

    def generate():
        resp = bedrock.invoke_model_with_response_stream(
            modelId=MODEL_ID,
            body=json.dumps({
                'anthropic_version': 'bedrock-2023-05-31',
                'max_tokens': 1024,
                'temperature': 0.7,
                'top_p': 0.9,
                'system': [{'type': 'text', 'text': SYSTEM_PROMPT}],
                'messages': messages,
            })
        )
        for event in resp['body']:
            chunk = json.loads(event['chunk']['bytes'])
            if chunk.get('type') == 'content_block_delta':
                delta = chunk['delta'].get('text', '')
                if delta:
                    yield delta

    return Response(stream_with_context(generate()), content_type='text/plain; charset=utf-8', headers=CORS_HEADERS)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 8080)))
