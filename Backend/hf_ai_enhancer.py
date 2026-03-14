"""
HuggingFace AI Enhancer for Resume Parsing
Provides LLM-powered skill extraction and enhancement
"""

import os
import logging
from typing import Optional, List, Dict, Any
from huggingface_hub import InferenceClient

logger = logging.getLogger(__name__)


class HFAIEnhancer:
    """
    Wrapper for HuggingFace Inference API
    Enhances resume data with LLM capabilities
    """
    
    def __init__(self, api_key: Optional[str] = None, model: str = "Qwen/Qwen2.5-72B-Instruct"):
        """
        Initialize HuggingFace AI Enhancer
        
        Args:
            api_key: HuggingFace API key (defaults to HF_API_KEY env var)
            model: Model to use (default: Qwen2.5-72B-Instruct, free tier)
        """
        self.api_key = api_key or os.getenv("HF_API_KEY")
        self.model = model
        
        if not self.api_key:
            logger.warning("⚠️ HF_API_KEY not set. HuggingFace enhancement will be disabled.")
            self.client = None
            return
        
        self.client = InferenceClient(api_key=self.api_key)
        logger.info(f"✅ HuggingFace AI Enhancer initialized with model: {self.model}")
    
    def is_available(self) -> bool:
        """Check if HuggingFace is available"""
        return self.client is not None
    
    def extract_skills(self, resume_text: str, max_tokens: int = 500) -> Optional[str]:
        """
        Extract technical skills from resume using LLM
        
        Args:
            resume_text: Full resume text
            max_tokens: Maximum tokens in response
            
        Returns:
            Extracted skills as comma-separated string
        """
        if not self.is_available():
            logger.warning("HuggingFace not configured, skipping skill extraction")
            return None
        
        try:
            messages = [
                {
                    "role": "user",
                    "content": f"""Extract all technical skills from this resume.
Return only the skills as a comma-separated list, no explanations.

Resume:
{resume_text[:2000]}"""
                }
            ]
            
            response = self.client.chat_completion(
                messages=messages,
                model=self.model,
                max_tokens=max_tokens,
                temperature=0.3
            )
            
            return response.choices[0].message.content.strip()
        
        except Exception as e:
            logger.error(f"Error extracting skills with HuggingFace: {e!r}")
            return None
    
    def score_candidate(self, resume_text: str, job_description: str, max_tokens: int = 200) -> Optional[Dict[str, Any]]:
        """
        Score candidate match against job description
        
        Args:
            resume_text: Full resume text
            job_description: Job description
            max_tokens: Maximum tokens in response
            
        Returns:
            Scoring result with score (0-100) and explanation
        """
        if not self.is_available():
            logger.warning("HuggingFace not configured, skipping candidate scoring")
            return None
        
        try:
            messages = [
                {
                    "role": "user",
                    "content": f"""Score how well this resume matches the job description on a scale of 0-100.
Return only: SCORE: [number] REASON: [one sentence]

Resume (first 2000 chars):
{resume_text[:2000]}

Job Description:
{job_description[:1000]}"""
                }
            ]
            
            response = self.client.chat_completion(
                messages=messages,
                model=self.model,
                max_tokens=max_tokens,
                temperature=0.3
            )
            response = response.choices[0].message.content
            
            # Parse response
            lines = response.strip().split('\n')
            result = {
                "score": 0,
                "reason": "",
                "raw_response": response
            }
            
            for line in lines:
                if "SCORE:" in line:
                    try:
                        score_str = line.split("SCORE:")[1].strip().split()[0]
                        result["score"] = int(score_str)
                    except (ValueError, IndexError):
                        pass
                elif "REASON:" in line:
                    result["reason"] = line.split("REASON:")[1].strip()
            
            return result
        
        except Exception as e:
            logger.error(f"Error scoring candidate with HuggingFace: {e!r}")
            return None
    
    def summarize_resume(self, resume_text: str, max_tokens: int = 300) -> Optional[str]:
        """
        Generate AI summary of resume
        
        Args:
            resume_text: Full resume text
            max_tokens: Maximum tokens in response
            
        Returns:
            Generated summary
        """
        if not self.is_available():
            logger.warning("HuggingFace not configured, skipping resume summary")
            return None
        
        try:
            messages = [
                {
                    "role": "user",
                    "content": f"""Summarize this resume in 2-3 sentences, focusing on key qualifications and experience.

Resume:
{resume_text[:3000]}"""
                }
            ]
            
            response = self.client.chat_completion(
                messages=messages,
                model=self.model,
                max_tokens=max_tokens,
                temperature=0.5
            )
            
            return response.choices[0].message.content.strip()
        
        except Exception as e:
            logger.error(f"Error summarizing resume with HuggingFace: {e!r}")
            return None


# Singleton instance
_enhancer: Optional[HFAIEnhancer] = None

def get_enhancer() -> HFAIEnhancer:
    """Get or create HuggingFace AI Enhancer instance"""
    global _enhancer
    if _enhancer is None:
        _enhancer = HFAIEnhancer()
    return _enhancer
