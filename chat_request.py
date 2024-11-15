import os
from openai import OpenAI

def send_openai_request(prompt, system_prompt=None, openai_api_key=None, openai_model=None):
    
    try:
        print(f"openai_api_key: {openai_api_key}")
        openai_client = OpenAI(api_key=openai_api_key)
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        response = openai_client.chat.completions.create(
            model=openai_model,
            messages=messages,
            response_format={"type": "json_object"},
        )
        
        return response.choices[0].message.content
    except Exception as e:
        print(f"Error in OpenAI request: {str(e)}")
        raise e
