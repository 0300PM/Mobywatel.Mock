# -*- coding: utf-8 -*-
"""Katalog modeli Cloudflare Workers AI dostępnych w darmowym planie.

Katalog jest listą zamkniętą: model spoza niej jest odrzucany, zanim żądanie poleci do Cloudflare.
Wszystkie wpisy to modele otwarte z wywoływaniem narzędzi, uruchamiane w Workers AI na koncie Cloudflare —
płatność idzie z dziennego limitu darmowego planu (10 000 neuronów dziennie), a nie z karty.

Każdy wpis ma przybliżoną prędkość (tokeny na sekundę), okno kontekstu i informację, czy model obsługuje
wywoływanie narzędzi. Dzięki temu wybór automatyczny bierze model, który uniesie instrukcję systemową
i 66 narzędzi, i nie przekroczy okna kontekstu.

Wybór: python3 serwer/katalog.py
"""
import sys


class Model:
    def __init__(self, nazwa, tok_s, kontekst, opis, bielik=False, narzedzia=True, darmowy=True, mocny=False):
        self.nazwa = nazwa
        self.tok_s = tok_s
        self.kontekst = kontekst
        self.opis = opis
        self.bielik = bielik
        self.narzedzia = narzedzia
        self.darmowy = darmowy
        self.mocny = mocny

    def jako_dict(self):
        return dict(nazwa=self.nazwa, tok_s=self.tok_s, kontekst=self.kontekst, opis=self.opis,
                    bielik=self.bielik, narzedzia=self.narzedzia, darmowy=self.darmowy, mocny=self.mocny)


KATALOG = (
    Model('@cf/ibm-granite/granite-4.0-h-micro', 420, 131072,
          'Granite 4.0 Micro: najmniejszy i najtańszy w neuronach, dobre narzędzia'),
    Model('@cf/swiss-ai/apertus-v1.5-8b', 380, 262144,
          'Apertus 8B: szybki model otwarty z dużym oknem i narzędziami'),
    Model('@cf/utter-project/eurollm-9b-it', 340, 32768,
          'EuroLLM 9B: europejski model wielojęzyczny, w tym polski'),
    Model('@cf/openai/gpt-oss-20b', 300, 131072,
          'gpt-oss 20B: mocny w narzędziach, rozsądny koszt w neuronach'),
    Model('@cf/qwen/qwen3-30b-a3b-fp8', 260, 33792,
          'Qwen3 30B (MoE): szybka generacja, dobra polszczyzna'),
    Model('@cf/meta/llama-4-scout-17b-16e-instruct', 240, 131072,
          'Llama 4 Scout (MoE): duże okno, szybkie odpowiedzi'),
    Model('@cf/zai-org/glm-4.7-flash', 210, 131072,
          'GLM 4.7 Flash: szybki model rozmowny z narzędziami'),
    Model('@cf/mistralai/mistral-small-3.1-24b-instruct', 190, 131072,
          'Mistral Small 3.1 24B: szybki model ogólny'),
    Model('@cf/google/gemma-4-26b-a4b-it', 180, 262144,
          'Gemma 4 26B (MoE): duże okno i dobre instrukcje'),
    Model('@cf/openai/gpt-oss-120b', 150, 131072,
          'gpt-oss 120B: najlepsze narzędzia w zestawie, szybciej zużywa limit', mocny=True),
    Model('@cf/nvidia/nemotron-3-120b-a12b', 120, 262144,
          'Nemotron 3 120B (MoE): duże okno, wyższa jakość', mocny=True),
    Model('@cf/moonshotai/kimi-k2.6', 100, 262144,
          'Kimi K2.6: najwyższa jakość i największe okno, najdroższy w neuronach', mocny=True),
)


def _klucz(nazwa):
    return (nazwa or '').strip().lower()


def znajdz(nazwa):
    """Model z katalogu albo None. Nazwy Workers AI nie mają sufiksów, więc porównanie jest wprost."""
    return PO_NAZWIE.get(_klucz(nazwa))


def czy_dozwolony(nazwa):
    return znajdz(nazwa) is not None


def czy_bielik(nazwa):
    model = znajdz(nazwa)
    return bool(model and model.bielik) or 'bielik' in _klucz(nazwa)


def uporzadkuj(preferuj='auto'):
    """Kolejność wyboru: `auto` i `szybkosc` po prędkości, `jakosc` najpierw modele mocne."""
    if preferuj == 'jakosc':
        return sorted(KATALOG, key=lambda m: (not m.mocny, -m.tok_s))
    return sorted(KATALOG, key=lambda m: -m.tok_s)


def wybierz(dostepne, preferuj='auto', okno=32768):
    """Najszybszy model z katalogu, który Cloudflare widzi na koncie i który uniesie okno kontekstu.

    `dostepne=None` oznacza, że nie udało się pobrać listy modeli konta — wtedy wybieramy z katalogu,
    bo brak listy nie jest powodem, żeby asystent nie odpowiadał.
    """
    widoczne = None if dostepne is None else {_klucz(n) for n in dostepne}
    for model in uporzadkuj(preferuj):
        if widoczne is not None and _klucz(model.nazwa) not in widoczne:
            continue
        if model.kontekst < okno:
            continue
        return model
    return None


def najszybsze(ile=5):
    return sorted(KATALOG, key=lambda m: -m.tok_s)[:ile]


def raport():
    linie = ['Katalog modeli Cloudflare Workers AI (darmowy plan, wywoływanie narzędzi):']
    for model in uporzadkuj():
        linie.append('  %-46s %4d tok/s  okno %7d  %s' % (model.nazwa, model.tok_s, model.kontekst, model.opis))
    return '\n'.join(linie)


PO_NAZWIE = {_klucz(m.nazwa): m for m in KATALOG}


if __name__ == '__main__':
    print(raport())
    sys.exit(0)
