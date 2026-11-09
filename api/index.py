# -*- coding: utf-8 -*-
"""Wejście aplikacji na Vercelu.

Vercel uruchamia ten plik jako funkcję (Flask), a ta jedynie przekazuje żądanie do serwera prototypu
(serwer/server.py, biblioteka standardowa Pythona) przez WSGI. Dzięki temu cała logika zostaje w jednym
miejscu: Vercel i Docker uruchamiają ten sam kod.

Czego Vercel nie daje:
  * serwera LM Studio na 127.0.0.1 — na Vercelu nie ma Twojego komputera, więc PROVIDER musi być workers
    (albo openai/anthropic), a nie lmstudio;
  * trwałego dysku — wszystkie pliki funkcji są tylko do odczytu (poza /tmp). Rejestr brakujących tłumaczeń
    i pamięć podręczna mowy są wtedy trzymane w pamięci, a nie zapisywane na dysku;
  * działającego procesu w tle — każde żądanie to osobne, krótkie uruchomienie funkcji.
"""
import os
import sys
import tempfile
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
SERWER = BASE / 'serwer'
sys.path.insert(0, str(SERWER))

# Na Vercelu dysk jest tylko do odczytu: logi i pamięć podręczną przenosimy do /tmp, a zapisy tłumaczeń
# (które i tak nie przetrwają kolejnego uruchomienia funkcji) wyłączamy.
TMP = Path(tempfile.gettempdir())
os.environ.setdefault('AGENT_LOG', str(TMP / 'agent.log'))
os.environ.setdefault('MOCKUP', str(BASE / 'mockup'))
os.environ.setdefault('MOB_TYLKO_ODCZYT', '1')
os.environ.setdefault('HOST', '0.0.0.0')

import server as prototyp  # noqa: E402  (serwer/server.py)

app = prototyp.app
