uv add fastapi "uvicorn[standard]" groq pydantic
$env:GROQ_API_KEY="your_key_here"
uv run uvicorn src.api:app --reload