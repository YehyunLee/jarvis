
from fastapi import FastAPI

app = FastAPI()


@app.get("/api/browse")
async def root():
    return {"message": "Hello World"}