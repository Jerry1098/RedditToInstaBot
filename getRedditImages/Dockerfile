FROM python:3.7-alpine3.13

WORKDIR /usr/src/app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV GOOGLE_APPLICATION_CREDENTIALS "/usr/src/app/client_secrets.json"
ENV TO_UPLOAD_DIR "/tmp/to_upload"
ENV TO_CHECK_DIR "/tmp/to_check"

CMD ["python", "./getRedditImages.py"]