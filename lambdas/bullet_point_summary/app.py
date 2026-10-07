import json, os, boto3
from flask import Flask, request, Response, stream_with_context

app = Flask(__name__)
bedrock = boto3.client('bedrock-runtime', region_name='ap-southeast-5')
MODEL_ID = 'global.anthropic.claude-haiku-4-5-20251001-v1:0'

PROMPT = "Summarize the core concepts and key points from the uploaded lecture notes into a clear, structured list of 5 to 7 concise bullet points. Focus on main ideas and essential takeaways."
TEMPERATURE = 0.3
TOP_P = 0.9

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

    content = []
    if file_data:
        if file_mime.startswith('image/'):
            img_fmt = file_mime.split('/')[-1]
            if img_fmt == 'jpg': img_fmt = 'jpeg'
            content.append({
                'type': 'image',
                'source': {'type': 'base64', 'media_type': file_mime, 'data': file_data}
            })
        else:
            content.append({
                'type': 'document',
                'source': {'type': 'base64', 'media_type': file_mime, 'data': file_data}
            })
    content.append({'type': 'text', 'text': PROMPT})

    messages = [{'role': 'user', 'content': content}]

    def generate():
        resp = bedrock.invoke_model_with_response_stream(
            modelId=MODEL_ID,
            body=json.dumps({
                'anthropic_version': 'bedrock-2023-05-31',
                'max_tokens': 2048,
                'temperature': TEMPERATURE,
                'top_p': TOP_P,
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
