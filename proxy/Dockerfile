FROM python:3-alpine
ADD requirements.txt /
RUN pip install -r /requirements.txt
ADD proxy.py /
ENTRYPOINT ["python3", "/proxy.py", "--logging=info"]