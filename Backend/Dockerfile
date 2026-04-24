# Use the official Python 3.12 image
FROM python:3.12-slim

# Set the working directory inside the container
WORKDIR /app

# Copy the requirements file first to leverage Docker caching
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend code
COPY . .

# Google Cloud Run dynamically sets the PORT environment variable (usually 8080)
ENV PORT=8080

# Command to run the app using Gunicorn and your config file
CMD ["gunicorn", "-c", "gunicorn_config.py", "run:app"]