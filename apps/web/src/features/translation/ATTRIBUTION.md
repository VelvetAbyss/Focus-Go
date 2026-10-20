# Offline translation attribution

The downloaded models are dedicated machine translation systems from the Helsinki-NLP / University of Helsinki OPUS-MT project (Jörg Tiedemann and contributors). ONNX conversions and quantization are distributed by Xenova (Hugging Face). Runtime: Hugging Face Transformers.js 3.8.1, Apache-2.0; ONNX Runtime Web, MIT.

Model repositories, exact ONNX revisions, files and sizes are listed in [models.json](./models.json). We use the upstream models converted to ONNX and quantized to 8-bit weights; this is a change of representation from the original checkpoints. No additional training is performed by Focus&go.

Upstream license metadata checked on 2026-10-19:

| Direction | Original checkpoint | License |
| --- | --- | --- |
| English → Chinese | https://huggingface.co/Helsinki-NLP/opus-mt-en-zh | Apache-2.0 |
| Chinese → English | https://huggingface.co/Helsinki-NLP/opus-mt-zh-en | CC-BY-4.0 |
| English → German | https://huggingface.co/Helsinki-NLP/opus-mt-en-de | CC-BY-4.0 |
| German → English | https://huggingface.co/Helsinki-NLP/opus-mt-de-en | Apache-2.0 |
| English → French | https://huggingface.co/Helsinki-NLP/opus-mt-en-fr | Apache-2.0 |
| French → English | https://huggingface.co/Helsinki-NLP/opus-mt-fr-en | Apache-2.0 |
| English → Spanish | https://huggingface.co/Helsinki-NLP/opus-mt-en-es | Apache-2.0 |
| Spanish → English | https://huggingface.co/Helsinki-NLP/opus-mt-es-en | Apache-2.0 |

- [OPUS-MT project and authors](https://github.com/Helsinki-NLP/Opus-MT)
- [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/)
- [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)
- [Transformers.js license](https://github.com/huggingface/transformers.js/blob/3.8.1/LICENSE)
- [ONNX Runtime license](https://github.com/microsoft/onnxruntime/blob/main/LICENSE)

MyMemory online access uses only the anonymous GET endpoint, not its contribution endpoint, account APIs or paid RapidAPI plans. It is a separate external service; [usage limits](https://mymemory.translated.net/doc/usagelimits.php) and [terms](https://mymemory.translated.net/terms-and-conditions) apply. Anonymous access is limited and does not promise service availability or confidential processing.
