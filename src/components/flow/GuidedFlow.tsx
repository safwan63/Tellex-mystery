import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";
import { Sparkles, ChevronDown } from "lucide-react";
import tellexquestionImg from "../Image/tellexquestion.webp";

// --- Validations ---
const emotionSchema = z.object({
  emotion: z.string().min(1, "Please select an emotion"),
  emotionOther: z.string().optional(),
  lifeSituation: z.string().min(1, "Please select your life situation"),
  lifeSituationOther: z.string().optional(),
  decisionStyle: z.string().min(1, "Please select your decision style"),
});

const intentSchema = z.object({
  reasons: z.array(z.string()).min(1, "Please select at least one reason").max(3, "You can select up to 3 reasons"),
  reasonsOther: z.string().optional(),
  wants: z.array(z.string()).min(1, "Please select at least one want").max(3, "You can select up to 3 wants"),
  wantsOther: z.string().optional(),
  currentNeed: z.string().min(1, "Please select your current need"),
});

const preferenceSchema = z.object({
  bookType: z.string().min(1, "Please select a book type"),
});

const historySchema = z.object({
  readBooks: z.string().min(1, "Please list some books, or type 'None'"),
});

const budgetSchema = z.object({
  budget: z.string().optional(),
});

const deliverySchema = z.object({
  firstName: z.string().min(2, "First name is required"),
  lastName: z.string().min(2, "Last name is required"),
  address: z.string().min(10, "Full address is required"),
  city: z.string().min(2, "City is required"),
  pincode: z.string().regex(/^[0-9]{6}$/, "Must be a 6 digit pincode"),
  whatsapp: z.string().regex(/^[0-9]{10}$/, "Must be a valid 10 digit number"),
  alternativeNo: z.string().regex(/^[0-9]{10}$/, "Must be a valid 10 digit number"),
}).refine((data) => data.whatsapp !== data.alternativeNo, {
  message: "Phone No cannot be the same as WhatsApp number",
  path: ["alternativeNo"],
});

const quantitySchema = z.object({
  bookQuantity: z.string().min(1, "Please select the quantity of books"),
});

// Full schema (removed delivery constraints for Phase 3)
const fullSchema = z.object({
  ...emotionSchema.shape,
  ...intentSchema.shape,
  ...preferenceSchema.shape,
  ...historySchema.shape,
  ...budgetSchema.shape,
  ...quantitySchema.shape,
});

type FormData = z.infer<typeof fullSchema>;

interface Props {
  type: "mystery" | "vibe";
  language: string;
  onBack: () => void;
}

export default function GuidedFlow({ type, language, onBack }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentSection, setCurrentSection] = useState(1);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [insight, setInsight] = useState<{ scores: any, top2: string[], response: string, preview: string } | null>(null);
  const [isDescriptionOpen, setIsDescriptionOpen] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const { register, handleSubmit, trigger, watch, setValue, setError, clearErrors, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(fullSchema),
    defaultValues: {
      reasons: [],
      wants: [],
      bookQuantity: "",
      budget: "449"
    }
  });

  const isMalayalam = language.toLowerCase() === 'malayalam';
  const editionText = "1st Edition";
  const cards = isMalayalam
    ? [ { price: 449, cut: 499 }, { price: 549, cut: 599 }, { price: 649, cut: 699 } ]
    : [ { price: 449, cut: 499 }, { price: 549, cut: 599 }, { price: 649, cut: 699 }, { price: 749, cut: 799 }, { price: 849, cut: 899 } ];

  const formValues = watch();

  useEffect(() => {
    const savedState = sessionStorage.getItem("tellex_flow_state");
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        if (parsed.mode === "guided") {
          // Restore form values
          Object.keys(parsed.formValues || {}).forEach((key) => {
             setValue(key as any, parsed.formValues[key]);
          });
          if (parsed.section) setCurrentSection(parsed.section);
          if (parsed.insight) setInsight(parsed.insight);
          sessionStorage.removeItem("tellex_flow_state");
        }
      } catch (e) {}
    }
  }, [setValue]);

  const generateRiasecInsight = (data: FormData) => {
    let scores: Record<string, number> = { R:0, I:0, A:0, S:0, E:0, C:0 };

    // Decision Style (Heavy weight)
    if (data.decisionStyle === "Think deeply and analyze") scores.I += 4;
    if (data.decisionStyle === "Feel through it") scores.A += 4;
    if (data.decisionStyle === "Take action quickly") scores.E += 4;
    if (data.decisionStyle === "Talk to someone") scores.S += 4;

    // Current Need
    if (data.currentNeed === "Clarity") scores.I += 3;
    if (data.currentNeed === "Healing") scores.A += 3;
    if (data.currentNeed === "Motivation") scores.E += 3;
    if (data.currentNeed === "Peace") scores.S += 3;

    // Emotion
    const em = data.emotion || "";
    if (em.includes("Anxious") || em.includes("Frustrated")) scores.I += 2; 
    if (em.includes("Low / Sad") || em.includes("Empty")) scores.A += 2;
    if (em.includes("Hopeful") || em.includes("Happy")) scores.E += 2;
    if (em.includes("Peaceful") || em.includes("Relaxed")) scores.S += 2;

    // Life Situation
    const ls = data.lifeSituation || "";
    if (ls.includes("stuck") || ls.includes("confused")) scores.I += 2;
    if (ls.includes("Heartbreak") || ls.includes("loss")) scores.A += 2;
    if (ls.includes("personal growth") || ls.includes("goal")) scores.E += 2;
    if (ls.includes("mental calm") || ls.includes("beginning")) scores.S += 2;

    // Intents
    data.reasons.forEach(r => {
      if (r.includes("reflect") || r.includes("learn")) scores.I += 1;
      if (r.includes("explore")) scores.E += 1;
      if (r.includes("relax") || r.includes("unexpected")) scores.S += 1;
      if (r.includes("healing") || r.includes("inspiration")) scores.A += 1;
    });

    data.wants.forEach(w => {
      if (w.includes("mindset") || w.includes("Perspective")) scores.I += 2;
      if (w.includes("Motivation")) scores.E += 2;
      if (w.includes("Peace") || w.includes("Comfort")) scores.S += 2;
      if (w.includes("Connection") || w.includes("healing") || w.includes("Creativity")) scores.A += 2;
    });

    const sorted = Object.entries(scores).sort((a,b) => b[1] - a[1]);
    const top2 = [sorted[0][0], sorted[1][0]];
    const primaryTrait = top2[0];
    const secondaryTrait = top2[1];

    console.log("=== RIASEC ENGINE DATA ===");
    console.log("Input:", data);
    console.log("Computed Scores:", scores);
    console.log("Top 2 Traits:", top2);
    
    const emotionText = (data.emotion === "✍️ Other" ? data.emotionOther : data.emotion)?.replace(/[^a-zA-Z\s]/g, '').trim().toLowerCase() || "the way you feel";
    const sitText = (data.lifeSituation === "✍️ Other" ? data.lifeSituationOther : data.lifeSituation)?.replace(/[^a-zA-Z\s]/g, '').trim().toLowerCase() || "this moment";

    let preview = "";
    let fullExplanation = "";
    
    if (primaryTrait === "I") {
      preview = `We see that you're navigating ${sitText} and dealing with feeling ${emotionText}. Because you naturally want to analyze and understand things deeply, you aren't just looking for an escape—you're seeking cognitive clarity and a genuine shift in perspective...`;
      fullExplanation = `Your responses indicate a highly analytical mindset right now. We are selecting a book that respects your intellect, challenges your current framework, and offers the structural clarity you crave to move forward.`;
    } else if (primaryTrait === "A") {
      preview = `Sitting with feeling ${emotionText} through ${sitText} takes an emotional toll. It's clear that right now, you need more than just information or a generic story—you're searching for deep emotional resonance and a safe space to process how you feel...`;
      fullExplanation = `You are leading with your heart and seeking meaning. We are curating a profoundly moving read that honors your emotional depth, validates your experience, and helps you find beauty or healing in this chapter of your life.`;
    } else if (primaryTrait === "E") {
      preview = `You're currently experiencing ${sitText} and the feeling of being ${emotionText}. But beneath that, you have a strong drive for momentum. You're not looking to sit still—you're actively seeking the spark and motivation to push forward and conquer what's next...`;
      fullExplanation = `Your answers reveal an enterprising, action-oriented energy. We will select a highly dynamic, thought-provoking book designed to ignite your ambition, break your blockages, and push you into your next era of growth.`;
    } else {
      preview = `Moving through ${sitText} while feeling ${emotionText} can be exhausting. What stands out most is your need for psychological safety and grounding. Right now, you are looking for comfort, human connection, and a sense of profound peace...`;
      fullExplanation = `We sense a deep desire for balance and comfort in your flow mapping. We are carefully choosing a warm, restorative book that wraps around you like a quiet sanctuary, giving you the space to breathe and reconnect.`;
    }

    const flavorMap: Record<string, string> = {
      I: "with profound intellectual depth.",
      A: "with raw, honest humanity.",
      E: "with actionable, powerful momentum.",
      S: "with a warm, comforting embrace."
    };
    
    const closing = `Something meaningful is on its way, crafted safely for you ${flavorMap[secondaryTrait] || "to experience soon."}`;

    const response = `${preview.replace('...', '.')}\n\n${fullExplanation}\n\n${closing}`;

    console.log("Generated PREVIEW:", preview);
    console.log("Generated RESPONSE:", response);

    return { scores, top2, response, preview };
  };

  const handleNext = async () => {
    let isValid = false;
    switch (currentSection) {
      case 1: isValid = true; break;
      case 2: 
        isValid = await trigger(["emotion", "emotionOther", "lifeSituation", "lifeSituationOther", "decisionStyle"]); 
        if (formValues.emotion === "✍️ Other" && (!formValues.emotionOther || formValues.emotionOther.trim() === "")) { setError("emotionOther", {type: "manual", message: "Please specify your emotion"}); isValid = false; }
        if (formValues.lifeSituation === "✍️ Other" && (!formValues.lifeSituationOther || formValues.lifeSituationOther.trim() === "")) { setError("lifeSituationOther", {type: "manual", message: "Please specify your situation"}); isValid = false; }
        break;
      case 3: 
        isValid = await trigger(["reasons", "reasonsOther", "wants", "wantsOther", "currentNeed"]); 
        if ((formValues.reasons || []).includes("Other") && (!formValues.reasonsOther || formValues.reasonsOther.trim() === "")) { setError("reasonsOther", {type: "manual", message: "Please specify your reason"}); isValid = false; }
        if ((formValues.wants || []).includes("Other") && (!formValues.wantsOther || formValues.wantsOther.trim() === "")) { setError("wantsOther", {type: "manual", message: "Please specify what you want"}); isValid = false; }
        break;
      case 4: isValid = await trigger(["bookType", "readBooks"]); break;
      case 5: 
        isValid = await trigger(["bookQuantity"]); 
        if (isValid) {
          const generated = generateRiasecInsight(formValues);
          setInsight(generated);
        }
        break;
      case 6: 
        isValid = true;
        break;
      default: isValid = true;
    }
    
    if (isValid) {
      setCurrentSection(curr => curr + 1);
    }
  };

  const handleBack = () => {
    if (currentSection === 1) onBack();
    else setCurrentSection(curr => curr - 1);
  };

  const onSubmit = async (data: FormData) => {
    if (isSubmitting || !insight) return;
    setIsSubmitting(true);
    
    try {
      // PHASE 3 INTEGRATION: Convert answers to semantic profile and search
      const { processBookDiscovery } = await import("../../services/bookDiscovery");
      
      const questionnaireAnswers = {
        emotion: data.emotion === "✍️ Other" ? data.emotionOther || "" : data.emotion,
        lifeSituation: data.lifeSituation === "✍️ Other" ? data.lifeSituationOther || "" : data.lifeSituation,
        decisionStyle: data.decisionStyle,
        currentNeed: data.currentNeed,
        reasons: data.reasons.map(r => r === "Other" ? data.reasonsOther || "" : r),
        wants: data.wants.map(w => w === "Other" ? data.wantsOther || "" : w),
        bookType: data.bookType,
        readBooks: data.readBooks,
        bookQuantity: data.bookQuantity,
        language: language
      };

      const result = await processBookDiscovery(questionnaireAnswers);

      // We no longer create an 'order' immediately since payment/delivery is removed for now,
      // or we can still create it if needed. The prompt says: "DO NOT IMPLEMENT Payment integration, Ebook delivery".
      // We will just navigate to the results page with the candidates.
      
      navigate("/matches", { state: { result } });
      
    } catch (err) {
      console.error("Error finding books: ", err);
      alert("We couldn't find a suitable match from our current collection. Try changing a few preferences and search again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Checkbox helpers
  const toggleArrayItem = (field: "reasons" | "wants", value: string) => {
    const currentArray = watch(field) || [];
    if (currentArray.includes(value)) {
      setValue(field, currentArray.filter(v => v !== value));
      clearErrors(field);
    } else {
      if (currentArray.length >= 3) {
        setError(field, { type: "manual", message: "You can select up to 3 options" });
        return;
      }
      setValue(field, [...currentArray, value]);
      clearErrors(field);
    }
  };

  const slideVariants = {
    initial: { opacity: 0, x: 20 },
    enter: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  };

  // Lists for mapping
  const budgets = ["389"];
  const emotions = ["😊 Happy", "😌 Peaceful", "😟 Anxious", "😔 Low / Sad", "😤 Frustrated", "😍 Hopeful", "⬜ Empty", "✍️ Other"];
  const lifeSituations = ["✨ New beginnings", "💔 Heartbreak or loss", "🌀 Feeling stuck or confused", "📈 Seeking personal growth", "🧘 Need mental calm", "🎯 Working toward a goal", "✍️ Other"];
  const decisionStyles = ["Think deeply and analyze", "Feel through it", "Take action quickly", "Talk to someone"];
  
  const readingReasons = ["To relax", "To find inspiration", "To learn", "To reflect", "To explore", "To experience something unexpected", "Other"];
  const readingWants = ["New mindset", "Peace and calm", "Motivation", "Connection", "Perspective shift", "Creativity", "Comfort and healing", "Something good to read", "Other"];
  const currentNeeds = ["Clarity", "Healing", "Motivation", "Peace"];
  
  const bookTypes = ["Self-help / Mindset", "Fiction / Story", "Romance", "Mystery / Thriller"];

  if (orderComplete) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-8 mt-4 max-w-lg mx-auto">
        
        <div className="text-left space-y-4 bg-[#0E462B] text-[#e1cfbc] p-8 rounded-3xl shadow-xl">
          <SparklesIcon />
          {insight?.response.split('\n\n').map((para, idx) => (
             <p key={idx} className="text-lg leading-relaxed">{para}</p>
          ))}
        </div>

        <div className="text-left space-y-4 bg-white p-6 rounded-2xl border border-[#0E462B]/5 shadow-sm">
          {type === "mystery" ? (
            <>
              <p className="flex items-start gap-3 text-gray-700">
                <span className="text-[#0E462B] mt-1">•</span>
                <span>Your mystery book is being carefully selected… get ready for a surprise 📦✨</span>
              </p>
              <p className="flex items-start gap-3 text-gray-700">
                <span className="text-[#0E462B] mt-1">•</span>
                <span>Book remains a mystery until delivery.</span>
              </p>
            </>
          ) : (
            <>
              <p className="flex items-start gap-3 text-gray-700">
                <span className="text-[#0E462B] mt-1">•</span>
                <span>✨ Book will be revealed to you via WhatsApp within 24 hours.</span>
              </p>
            </>
          )}
        </div>

        <div className="flex flex-col items-center gap-3 pt-4">
          <button 
            onClick={() => navigate('/my-orders')}
            className="w-full sm:w-auto px-8 py-3 bg-[#0E462B] text-[#e1cfbc] font-bold rounded-xl hover:bg-[#0E462B]/90 transition-all shadow-sm"
          >
            Track My Order
          </button>
          <button 
            onClick={() => navigate('/dashboard')}
            className="text-sm font-bold text-[#0E462B] underline underline-offset-4 opacity-70 hover:opacity-100 transition-opacity"
          >
            Back to Dashboard
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="w-full">
      {/* ProgressBar */}
      <div className="w-full h-1.5 bg-[#E5E5E0] rounded-full mb-8 overflow-hidden">
        <div 
          className="h-full bg-[#0E462B] transition-all duration-500 ease-in-out" 
          style={{ width: `${(currentSection / 7) * 100}%` }}
        />
      </div>

      <AnimatePresence mode="wait">
        
        {/* SECTION 1 - Budget / Product Preview */}
        {currentSection === 1 && (
          <motion.div key="sec-1" variants={slideVariants} initial="initial" animate="enter" exit="exit" className="space-y-6 max-w-2xl mx-auto pb-4">
            <div className="bg-white rounded-3xl overflow-hidden shadow-xl border border-[#E5E5E0]">
              <div className="h-64 w-full relative overflow-hidden bg-[#e1cfbc]">
                 <picture>
                   <source media="(min-width: 768px)" srcSet={tellexquestionImg} />
                   <img src={tellexquestionImg} alt="Mystery Book" className="w-full h-full object-contain p-4 mix-blend-multiply opacity-90" />
                 </picture>
                 <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent flex items-end p-6">
                   <h2 className="text-4xl font-bold text-white drop-shadow-md" style={{ fontFamily: "'Playfair Display', serif" }}>The Mystery Pick</h2>
                 </div>
              </div>
              
               <div className="px-5 py-6 sm:px-8 space-y-4">
                 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                   <p className="text-[#0E462B] font-bold text-xs sm:text-sm uppercase tracking-wider flex items-center gap-1.5">
                     <Sparkles size={14} className="text-[#0E462B]" /> Mystery pick based on your feelings
                   </p>
                   <div className="inline-flex items-center justify-center px-3.5 py-1 bg-[#0E462B] text-white rounded-full w-fit">
                     <span className="text-[13px] font-medium whitespace-nowrap">Book Type: {editionText}</span>
                   </div>
                 </div>

                 <div className="pt-2">
                   <button 
                     onClick={() => setIsDescriptionOpen(!isDescriptionOpen)}
                     className="w-full flex items-center justify-between py-3 px-4 bg-gray-50 hover:bg-[#e1cfbc]/30 rounded-xl transition-colors"
                   >
                     <span className="font-bold text-[#0E462B] text-lg flex items-center gap-2">
                       <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                       View Details & Description
                     </span>
                     <ChevronDown className={`w-5 h-5 text-[#0E462B] transition-transform duration-300 ${isDescriptionOpen ? 'rotate-180' : ''}`} />
                   </button>
                   
                   <AnimatePresence>
                     {isDescriptionOpen && (
                       <motion.div 
                         initial={{ height: 0, opacity: 0 }}
                         animate={{ height: 'auto', opacity: 1 }}
                         exit={{ height: 0, opacity: 0 }}
                         className="overflow-hidden"
                       >
                         <div className="prose prose-sm sm:prose-base text-gray-600 pt-6 pb-2 space-y-4 px-2">
                           <h3 className="font-bold text-gray-800 text-lg mb-2">Product Details</h3>
                           <ul className="text-sm space-y-1 mb-4 text-gray-600">
                             <li><span className="font-semibold text-gray-800">Book Cover:</span> Paperback</li>
                             <li><span className="font-semibold text-gray-800">Book Type:</span> {editionText}</li>
                             <li><span className="font-semibold text-gray-800">Return Policy:</span> 3 days return policy</li>
                             <li><span className="font-semibold text-gray-800">Payment Method:</span> Pay at your doorstep</li>
                           </ul>
                           <p className="font-bold text-[#0E462B] text-xl leading-snug mt-6" style={{ fontFamily: "'Playfair Display', serif" }}>Not knowing is part of the magic.</p>
                           <p className="text-md">Mystery Pick is for readers who love surprises, curiosity, and the excitement of discovering something chosen especially for them.</p>
                           <p className="text-md">Tell us about yourself through a few questions or simply share your interests, favorite genres, and what kind of reading experience you're looking for. We'll carefully select a book that matches you. <br/><span className="font-bold text-[#0E462B] inline-block mt-2">The title remains a secret until you open the box.</span></p>

                           <div className="bg-[#e1cfbc]/20 rounded-2xl p-5 mt-6 border border-[#e1cfbc]/50">
                             <h4 className="font-bold text-gray-800 mb-3 text-lg">Why readers love Mystery Pick:</h4>
                             <ul className="space-y-3 list-none p-0 m-0">
                               <li className="flex items-start gap-3"><span className="text-xl">✨</span> <span className="pt-0.5">A personalized book chosen just for you</span></li>
                               <li className="flex items-start gap-3"><span className="text-xl">🎁</span> <span className="pt-0.5">Feels like receiving a thoughtful gift</span></li>
                               <li className="flex items-start gap-3"><span className="text-xl">📖</span> <span className="pt-0.5">Discover books you may never have picked yourself</span></li>
                               <li className="flex items-start gap-3"><span className="text-xl">💫</span> <span className="pt-0.5">A unique and exciting unboxing experience</span></li>
                               <li className="flex items-start gap-3"><span className="text-xl">🔍</span> <span className="pt-0.5">The thrill of mystery and anticipation</span></li>
                             </ul>
                           </div>

                           <p className="mt-6 pt-4 text-md">Whether you love fiction, romance, fantasy, thrillers, classics, self improvement, or something completely unexpected, every Mystery Pick is selected to create a memorable reading experience.</p>
                           <p className="font-medium text-[#0E462B] italic text-lg text-center mt-6 pt-6 border-t border-gray-100">"Sometimes the best part isn't knowing what's inside.<br/>It's the excitement of finding out."</p>
                         </div>
                       </motion.div>
                     )}
                   </AnimatePresence>
                 </div>
              </div>
            </div>

            <div className="flex gap-4 pt-4 sticky bottom-4 z-10">
              <button onClick={handleBack} className="px-6 py-4 font-bold text-gray-600 bg-white border-2 border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm">Back</button>
              <button onClick={handleNext} className="flex-1 px-6 py-4 font-bold text-[#e1cfbc] bg-[#0E462B] rounded-xl hover:bg-[#0E462B]/90 shadow-xl transition-all uppercase tracking-wide text-lg">Continue to Questions</button>
            </div>
          </motion.div>
        )}

        {/* SECTION 2 - Emotion, Situation, Decision Style */}
        {currentSection === 2 && (
          <motion.div key="sec-2" variants={slideVariants} initial="initial" animate="enter" exit="exit" className="space-y-10">
            <div>
              <h2 className="text-2xl font-bold text-[#0E462B] mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>How are you feeling right now?</h2>
              <div className="flex flex-wrap gap-3">
                {emotions.map(e => (
                  <button key={e} onClick={() => { setValue("emotion", e); clearErrors("emotion"); }} type="button"
                    className={`px-4 py-2 rounded-full border-2 text-sm font-medium transition-colors ${formValues.emotion === e ? "border-[#0E462B] bg-[#0E462B]/5 text-[#0E462B]" : "border-[#E5E5E0] hover:border-[#0E462B]/30 bg-white"}`}
                  >{e}</button>
                ))}
              </div>
              {formValues.emotion === "✍️ Other" && (
                <div className="mt-3">
                  <input {...register("emotionOther")} className="w-full px-4 py-3 border-2 border-[#E5E5E0] rounded-lg focus:border-[#0E462B] outline-none text-sm" placeholder="Please specify your emotion..." />
                  {errors.emotionOther && <p className="text-red-500 text-xs mt-1">{errors.emotionOther.message}</p>}
                </div>
              )}
              {errors.emotion && <p className="text-red-500 text-sm mt-2">{errors.emotion.message}</p>}
            </div>

            <div>
              <h2 className="text-2xl font-bold text-[#0E462B] mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>What describes your current life situation?</h2>
              <div className="flex flex-wrap gap-3">
                {lifeSituations.map(ls => (
                  <button key={ls} onClick={() => { setValue("lifeSituation", ls); clearErrors("lifeSituation"); }} type="button"
                    className={`px-4 py-2 rounded-full border-2 text-sm font-medium transition-colors ${formValues.lifeSituation === ls ? "border-[#0E462B] bg-[#0E462B]/5 text-[#0E462B]" : "border-[#E5E5E0] hover:border-[#0E462B]/30 bg-white"}`}
                  >{ls}</button>
                ))}
              </div>
              {formValues.lifeSituation === "✍️ Other" && (
                <div className="mt-3">
                  <input {...register("lifeSituationOther")} className="w-full px-4 py-3 border-2 border-[#E5E5E0] rounded-lg focus:border-[#0E462B] outline-none text-sm" placeholder="Please specify your situation..." />
                  {errors.lifeSituationOther && <p className="text-red-500 text-xs mt-1">{errors.lifeSituationOther.message}</p>}
                </div>
              )}
              {errors.lifeSituation && <p className="text-red-500 text-sm mt-2">{errors.lifeSituation.message}</p>}
            </div>

            <div>
              <h2 className="text-xl font-bold text-[#0E462B] mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>When facing a problem, what feels more natural to you?</h2>
              <div className="flex flex-col gap-3 border-l-4 border-[#0E462B]/20 pl-4 py-2">
                {decisionStyles.map(ds => (
                  <button key={ds} onClick={() => { setValue("decisionStyle", ds); clearErrors("decisionStyle"); }} type="button"
                    className={`px-4 py-3 text-left rounded-xl border-2 text-sm font-medium transition-colors ${formValues.decisionStyle === ds ? "border-[#0E462B] bg-[#0E462B]/5 text-[#0E462B]" : "border-[#E5E5E0] hover:border-[#0E462B]/30 bg-white"}`}
                  >{ds}</button>
                ))}
              </div>
              {errors.decisionStyle && <p className="text-red-500 text-sm mt-2">{errors.decisionStyle.message}</p>}
            </div>
            
            <div className="flex gap-4 pt-4">
              <button onClick={handleBack} className="px-6 py-3 font-medium text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-50">Back</button>
              <button onClick={handleNext} className="flex-1 px-6 py-3 font-medium text-[#e1cfbc] bg-[#0E462B] rounded-lg hover:bg-[#0E462B]/90">Continue</button>
            </div>
          </motion.div>
        )}

        {/* SECTION 3 - Reading Intent & Current Need */}
        {currentSection === 3 && (
          <motion.div key="sec-3" variants={slideVariants} initial="initial" animate="enter" exit="exit" className="space-y-10">
            <div>
              <h2 className="text-2xl font-bold text-[#0E462B] mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>Why do you want to read right now? <span className="text-sm font-normal text-gray-500 block">(Select up to 3)</span></h2>
              <div className="flex flex-wrap gap-3">
                {readingReasons.map(r => (
                  <button key={r} onClick={() => toggleArrayItem("reasons", r)} type="button"
                    className={`px-4 py-2 rounded-full border-2 text-sm font-medium transition-colors ${(formValues.reasons || []).includes(r) ? "border-[#0E462B] bg-[#0E462B]/5 text-[#0E462B]" : "border-[#E5E5E0] hover:border-[#0E462B]/30 bg-white"}`}
                  >{r}</button>
                ))}
              </div>
              {(formValues.reasons || []).includes("Other") && (
                <div className="mt-3">
                  <input {...register("reasonsOther")} className="w-full px-4 py-3 border-2 border-[#E5E5E0] rounded-lg focus:border-[#0E462B] outline-none text-sm" placeholder="Please specify your reason..." />
                  {errors.reasonsOther && <p className="text-red-500 text-xs mt-1">{errors.reasonsOther.message}</p>}
                </div>
              )}
              {errors.reasons && <p className="text-red-500 text-sm mt-2">{errors.reasons.message}</p>}
            </div>

            <div>
              <h2 className="text-2xl font-bold text-[#0E462B] mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>What do you want from this book? <span className="text-sm font-normal text-gray-500 block">(Select up to 3)</span></h2>
              <div className="flex flex-wrap gap-3">
                {readingWants.map(w => (
                  <button key={w} onClick={() => toggleArrayItem("wants", w)} type="button"
                    className={`px-4 py-2 rounded-full border-2 text-sm font-medium transition-colors ${(formValues.wants || []).includes(w) ? "border-[#0E462B] bg-[#0E462B]/5 text-[#0E462B]" : "border-[#E5E5E0] hover:border-[#0E462B]/30 bg-white"}`}
                  >{w}</button>
                ))}
              </div>
              {(formValues.wants || []).includes("Other") && (
                <div className="mt-3">
                  <input {...register("wantsOther")} className="w-full px-4 py-3 border-2 border-[#E5E5E0] rounded-lg focus:border-[#0E462B] outline-none text-sm" placeholder="Please specify what you want..." />
                  {errors.wantsOther && <p className="text-red-500 text-xs mt-1">{errors.wantsOther.message}</p>}
                </div>
              )}
              {errors.wants && <p className="text-red-500 text-sm mt-2">{errors.wants.message}</p>}
            </div>

            <div>
              <h2 className="text-xl font-bold text-[#0E462B] mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>What do you feel you need the most right now?</h2>
              <div className="flex flex-col gap-3 border-l-4 border-[#e1cfbc] pl-4 py-2">
                {currentNeeds.map(cn => (
                  <button key={cn} onClick={() => { setValue("currentNeed", cn); clearErrors("currentNeed"); }} type="button"
                    className={`px-4 py-3 text-left rounded-xl border-2 text-sm font-medium transition-colors ${formValues.currentNeed === cn ? "border-[#0E462B] bg-[#0E462B]/5 text-[#0E462B]" : "border-[#E5E5E0] hover:border-[#0E462B]/30 bg-white"}`}
                  >{cn}</button>
                ))}
              </div>
              {errors.currentNeed && <p className="text-red-500 text-sm mt-2">{errors.currentNeed.message}</p>}
            </div>

            <div className="flex gap-4 pt-4">
              <button onClick={handleBack} className="px-6 py-3 font-medium text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-50">Back</button>
              <button onClick={handleNext} className="flex-1 px-6 py-3 font-medium text-[#e1cfbc] bg-[#0E462B] rounded-lg hover:bg-[#0E462B]/90">Continue</button>
            </div>
          </motion.div>
        )}

        {/* SECTION 4 - Preferences & Reading History */}
        {currentSection === 4 && (
          <motion.div key="sec-4" variants={slideVariants} initial="initial" animate="enter" exit="exit" className="space-y-10">
            <div>
              <h2 className="text-2xl font-bold text-[#0E462B] mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>What type of book are you looking for?</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {bookTypes.map(bt => (
                  <button key={bt} onClick={() => setValue("bookType", bt)} type="button"
                    className={`p-4 text-left rounded-xl border-2 font-medium transition-colors ${formValues.bookType === bt ? "border-[#0E462B] bg-[#0E462B]/5 text-[#0E462B]" : "border-[#E5E5E0] hover:border-[#0E462B]/30 bg-white"}`}
                  >{bt}</button>
                ))}
              </div>
              {errors.bookType && <p className="text-red-500 text-sm mt-2">{errors.bookType.message}</p>}
            </div>

            <div>
              <h2 className="text-2xl font-bold text-[#0E462B] mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>List some books you've already read and enjoyed.</h2>
              <p className="text-gray-500 mb-4">This helps us avoid sending you something you already have.</p>
              <textarea 
                {...register("readBooks")}
                className="w-full h-32 p-4 border-2 border-[#E5E5E0] rounded-xl focus:border-[#0E462B] focus:ring-0 outline-none resize-none"
                placeholder="e.g. Atomic Habits, The Alchemist, or type 'None'"
              />
              {errors.readBooks && <p className="text-red-500 text-sm mt-2">{errors.readBooks.message}</p>}
            </div>

            <div className="flex gap-4 pt-4">
              <button onClick={handleBack} className="px-6 py-3 font-medium text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-50">Back</button>
              <button onClick={handleNext} className="flex-1 px-6 py-3 font-medium text-[#e1cfbc] bg-[#0E462B] rounded-lg hover:bg-[#0E462B]/90">Continue</button>
            </div>
          </motion.div>
        )}

        {/* SECTION 5 - Book Quantity */}
        {currentSection === 5 && (
          <motion.div key="sec-5" variants={slideVariants} initial="initial" animate="enter" exit="exit" className="space-y-10">
            <div>
              <h2 className="text-2xl font-bold text-[#0E462B] mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>Quantity of books?</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {["1", "2", "3"].map(q => (
                  <button key={q} onClick={() => setValue("bookQuantity", q)} type="button"
                    className={`p-6 text-center rounded-xl border-2 font-bold text-xl transition-all duration-200 ${formValues.bookQuantity === q ? "border-[#0E462B] bg-[#0E462B] text-[#e1cfbc] shadow-md scale-105" : "border-[#E5E5E0] text-gray-700 hover:border-[#0E462B]/30 bg-white"}`}
                  >
                    {q}
                  </button>
                ))}
              </div>
              {errors.bookQuantity && <p className="text-red-500 text-sm mt-3">{errors.bookQuantity.message}</p>}
            </div>

            <div className="flex gap-4 pt-4">
              <button onClick={handleBack} className="px-6 py-3 font-medium text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-50">Back</button>
              <button onClick={handleNext} className="flex-1 px-6 py-3 font-medium text-[#e1cfbc] bg-[#0E462B] rounded-lg hover:bg-[#0E462B]/90">Continue</button>
            </div>
          </motion.div>
        )}

        {/* SECTION 6 - Summary */}
        {currentSection === 6 && (
          <motion.div key="sec-6" variants={slideVariants} initial="initial" animate="enter" exit="exit" className="space-y-8">
            <div className="flex justify-between items-center border-b border-[#E5E5E0] pb-4">
              <h2 className="text-2xl font-bold text-[#0E462B]" style={{ fontFamily: "'Playfair Display', serif" }}>Summary</h2>
              <button onClick={() => setCurrentSection(1)} className="text-sm font-medium text-[#0E462B] hover:underline">Edit Selection</button>
            </div>

            {insight && (
              <div className="bg-[#0E462B]/5 border-l-4 border-[#0E462B] p-6 rounded-r-2xl mb-2 space-y-4">
                <h3 className="text-sm font-bold text-[#0E462B] tracking-widest uppercase flex items-center gap-2">
                  <Sparkles size={16} /> Here's what we understood about you...
                </h3>
                <p className="text-gray-800 text-lg leading-relaxed italic">
                  {insight.preview}
                </p>
                <div className="text-sm font-bold text-[#0E462B]/60 flex items-center gap-2 border-t border-[#0E462B]/10 pt-3">
                  ✨ Enter your delivery details next to reveal our full curation intent 
                </div>
              </div>
            )}
            
            <div className="bg-white p-6 rounded-2xl border border-[#E5E5E0] space-y-4 text-sm">
              <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Pick Type</span><span className="font-medium text-right capitalize">{type} Pick</span></div>
              <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Emotion</span><span className="font-medium text-right">{formValues.emotion === "✍️ Other" ? formValues.emotionOther : formValues.emotion}</span></div>
              <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Situation</span><span className="font-medium text-right">{formValues.lifeSituation === "✍️ Other" ? formValues.lifeSituationOther : formValues.lifeSituation}</span></div>
              <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Decision Style</span><span className="font-medium text-right">{formValues.decisionStyle}</span></div>
              <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Goal</span><span className="font-medium text-right">{formValues.currentNeed}</span></div>
              <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Book Type</span><span className="font-medium text-right">{formValues.bookType}</span></div>
              <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Quantity</span><span className="font-medium text-right">{formValues.bookQuantity} {parseInt(formValues.bookQuantity) === 1 ? 'Book' : 'Books'}</span></div>
              <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Language</span><span className="font-medium text-right">{language}</span></div>
              <div className="flex flex-col border-b pb-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Budget per book</span>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setShowBreakdown(!showBreakdown)} className="text-xs text-[#0E462B] font-bold underline underline-offset-2">
                      {showBreakdown ? "Hide Breakdown" : "View Breakdown"}
                    </button>
                    <span className="font-medium text-right">₹{formValues.budget}</span>
                  </div>
                </div>
                {showBreakdown && (
                  <div className="mt-3 bg-[#e1cfbc]/20 p-4 rounded-xl border border-[#e1cfbc]/50 space-y-2">
                    <div className="flex justify-between text-sm"><span className="text-gray-600">Book Price</span><span className="font-medium">₹{(parseInt(formValues.budget || "0") - 150) * parseInt(formValues.bookQuantity || "1")}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-600">Service Charge</span><span className="font-medium">₹{150 * parseInt(formValues.bookQuantity || "1")}</span></div>
                    <div className="flex justify-between text-sm"><span className="text-gray-600">Delivery Charge</span><span className="font-bold text-green-600 uppercase text-xs tracking-wider pt-0.5">Free</span></div>
                  </div>
                )}
              </div>
              <div className="flex justify-between pb-2"><span className="text-gray-500">Total Price</span><span className="font-bold text-[#0E462B] text-right text-lg">₹{(parseInt(formValues.budget || "0") * parseInt(formValues.bookQuantity || "1")).toString()}</span></div>
            </div>

            {type === "mystery" && (
              <div className="bg-[#e1cfbc]/30 p-6 rounded-xl text-center border border-[#e1cfbc]">
                <p className="font-medium text-[#0E462B]/80 text-sm">Book name will stay a mystery until it reaches you 🎁</p>
              </div>
            )}

            <div className="pt-2">
              <div className="flex gap-4">
                <button onClick={handleBack} disabled={isSubmitting} className="px-6 py-4 font-medium text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">Back</button>
                <button onClick={handleSubmit(onSubmit)} disabled={isSubmitting} className="flex-1 px-6 py-4 font-bold text-[#e1cfbc] bg-[#0E462B] rounded-lg hover:bg-[#0E462B]/90 shadow-lg disabled:opacity-50 transition-all uppercase tracking-wide">
                  {isSubmitting ? "Finding books that fit..." : "Find Book Matches"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SparklesIcon() {
  return (
    <svg className="w-10 h-10 mb-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  );
}
