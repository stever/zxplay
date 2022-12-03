FROM python:3-alpine
ADD proxy.py /
ADD requirements.txt /
RUN pip install -r /requirements.txt
CMD ["python3", "/proxy.py"]