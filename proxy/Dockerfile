FROM python:3-alpine
ADD requirements.txt /
RUN pip install -r /requirements.txt
ADD proxy.py /
CMD ["python3", "/proxy.py", "--logging=info", "--origin=https://speccytools.org/emu"]