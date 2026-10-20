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
const vibeSchema = z.object({
  vibe: z.string().min(10, "Please describe your vibe in a bit more detail (min 10 chars)"),
});

const followUpSchema = z.object({
  bookType: z.string().optional(),
  avoidTrigger: z.string().optional(),
  readBooks: z.string().min(1, "Please list some books, or type 'None'"),
});

const budgetSchema = z.object({
  budget: z.string().optional(),
});

const fullSchema = z.object({
  ...vibeSchema.shape,
  ...followUpSchema.shape,
  ...budgetSchema.shape,
  bookQuantity: z.string().min(1, "Please select the quantity of books"),
});

type FormData = z.infer<typeof fullSchema>;

interface Props {
  type: "mystery" | "vibe";
  language: string;
  onBack: () => void;
}

export default function FreeFlow({ type, language, onBack }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentSection, setCurrentSection] = useState(1);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [insight, setInsight] = useState<{ response: string, preview: string } | null>(null);
  const [isDescriptionOpen, setIsDescriptionOpen] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const { register, handleSubmit, trigger, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(fullSchema),
    defaultValues: {
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
        if (parsed.mode === "free") {
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

  const handleNext = async () => {
    let isValid = false;
    switch (currentSection) {
      case 1: isValid = true; break;
      case 2: isValid = await trigger(["vibe"]); break;
      case 3: isValid = await trigger(["bookType", "avoidTrigger", "readBooks"]); break;
      case 4: 
        isValid = await trigger(["bookQuantity"]); 
        if (isValid) {
          const preview = "Thank you for sharing your thoughts so openly. From what you've shared, we can feel the specific energy and situation you're navigating right now...";
          const response = `${preview.replace('...', '.')}\n\nWe are carefully curating a book that understands your vibe and meets you exactly where you are.\n\nSomething truly meaningful is on its way.`;
          setInsight({ preview, response });
        }
        break;
      case 5:
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
        emotion: "", // Handled via freeText
        lifeSituation: "",
        decisionStyle: "",
        currentNeed: "",
        reasons: [],
        wants: [],
        bookType: data.bookType || "Any",
        readBooks: data.readBooks,
        bookQuantity: data.bookQuantity,
        freeText: data.vibe + (data.avoidTrigger && data.avoidTrigger !== "None" ? ` (Avoid: ${data.avoidTrigger})` : ""),
        language: language
      };

      const result = await processBookDiscovery(questionnaireAnswers);

      navigate("/matches", { state: { result } });
      
    } catch (err) {
      console.error("Error finding books: ", err);
      alert("We couldn't find a suitable match from our current collection. Try changing a few preferences and search again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const slideVariants = {
    initial: { opacity: 0, x: 20 },
    enter: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
  };

  const budgets = ["389"];

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
          style={{ width: `${(currentSection / 6) * 100}%` }}
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

        {/* SECTION 2 - Vibe/Problem input */}
        {currentSection === 2 && (
          <motion.div key="sec-2" variants={slideVariants} initial="initial" animate="enter" exit="exit" className="space-y-10">
            <div>
              <h2 className="text-2xl font-bold text-[#0E462B] mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>Tell us about your vibe or current problem</h2>
              <p className="text-gray-500 mb-4">Freely write whatever is on your mind. A feeling, a scenario, a genre, a specific lesson you want to learn.</p>
              <textarea 
                {...register("vibe")}
                className="w-full h-40 p-5 text-lg border-2 border-[#E5E5E0] rounded-xl focus:border-[#0E462B] focus:ring-0 outline-none resize-none"
                placeholder="I'm feeling a bit lost in my career right now and I want a book that..."
              />
              {errors.vibe && <p className="text-red-500 text-sm mt-2">{errors.vibe.message}</p>}
            </div>

            <div className="flex gap-4 pt-4">
              <button onClick={handleBack} className="px-6 py-3 font-medium text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-50">Back</button>
              <button onClick={handleNext} className="flex-1 px-6 py-3 font-medium text-[#e1cfbc] bg-[#0E462B] rounded-lg hover:bg-[#0E462B]/90">Continue</button>
            </div>
          </motion.div>
        )}

        {/* SECTION 3 - Follow Up */}
        {currentSection === 3 && (
          <motion.div key="sec-3" variants={slideVariants} initial="initial" animate="enter" exit="exit" className="space-y-8">
            <h2 className="text-2xl font-bold text-[#0E462B]" style={{ fontFamily: "'Playfair Display', serif" }}>A few quick follow-ups</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Any specific Book Type? (Optional)</label>
              <input {...register("bookType")} className="w-full px-4 py-3 border-2 border-[#E5E5E0] rounded-lg focus:border-[#0E462B] outline-none" placeholder="e.g. Fiction, Self-help, Thriller" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Anything we should AVOID? (Triggers, genres, etc.)</label>
              <input {...register("avoidTrigger")} className="w-full px-4 py-3 border-2 border-[#E5E5E0] rounded-lg focus:border-[#0E462B] outline-none" placeholder="e.g. No romance, no gore" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Books you've already read (Required)</label>
              <textarea 
                {...register("readBooks")}
                className="w-full h-24 p-4 border-2 border-[#E5E5E0] rounded-lg focus:border-[#0E462B] outline-none resize-none"
                placeholder="e.g. Atomic Habits, or type 'None'"
              />
              {errors.readBooks && <p className="text-red-500 text-sm mt-1">{errors.readBooks.message}</p>}
            </div>

            <div className="flex gap-4 pt-4">
              <button onClick={handleBack} className="px-6 py-3 font-medium text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-50">Back</button>
              <button onClick={handleNext} className="flex-1 px-6 py-3 font-medium text-[#e1cfbc] bg-[#0E462B] rounded-lg hover:bg-[#0E462B]/90">Continue</button>
            </div>
          </motion.div>
        )}

        {/* SECTION 4 - Book Quantity */}
        {currentSection === 4 && (
          <motion.div key="sec-4" variants={slideVariants} initial="initial" animate="enter" exit="exit" className="space-y-10">
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

        {/* SECTION 5 - Summary */}
        {currentSection === 5 && (
          <motion.div key="sec-5" variants={slideVariants} initial="initial" animate="enter" exit="exit" className="space-y-8">
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
              <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Language</span><span className="font-medium text-right">{language}</span></div>
              <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Book Type</span><span className="font-medium text-right">{formValues.bookType || "Any"}</span></div>
              <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Quantity</span><span className="font-medium text-right">{formValues.bookQuantity} {parseInt(formValues.bookQuantity) === 1 ? 'Book' : 'Books'}</span></div>
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
