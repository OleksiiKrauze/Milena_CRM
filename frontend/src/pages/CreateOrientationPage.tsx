import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Rnd } from 'react-rnd';
import html2canvas from 'html2canvas';
import { searchesApi } from '@/api/searches';
import { flyerTemplatesApi } from '@/api/flyerTemplates';
import { orientationsApi } from '@/api/orientations';
import { uploadApi } from '@/api/upload';
import { Header } from '@/components/layout/Header';
import { Container, Card, CardHeader, CardTitle, CardContent, Button, Loading } from '@/components/ui';
import { FileImage, Upload, Download, Check } from 'lucide-react';
import type { FlyerTemplate } from '@/types/api';

interface PhotoPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TemplatePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface TextFieldPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LogoItem {
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DateItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export function CreateOrientationPage() {
  const { searchId, orientationId } = useParams<{ searchId: string; orientationId?: string }>();
  const [searchParams] = useSearchParams();
  const duplicateId = searchParams.get('duplicate');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textEditableRef = useRef<HTMLDivElement>(null);
  const [canvasScale, setCanvasScale] = useState(1);
  const isEditMode = !!orientationId && !duplicateId;
  const isDuplicateMode = !!duplicateId;

  // State
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [textContent, setTextContent] = useState<string>('');
  const [isApproved, setIsApproved] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [canvasData, setCanvasData] = useState<Record<string, unknown>>({});
  const [exportedFiles, setExportedFiles] = useState<string[]>([]);

  // Text formatting state
  const [fontSize, setFontSize] = useState(28);
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('center');
  const [textColor, setTextColor] = useState('#000000');

  // Vertical text fields
  const [cityText, setCityText] = useState<string>('');
  const [cityPosition, setCityPosition] = useState({ x: 10, y: 20 });
  const [dateText, setDateText] = useState<string>(`${new Date().toLocaleDateString('uk-UA')}р.`);
  const [datePosition, setDatePosition] = useState({ x: 655, y: 40 });

  // Positions and sizes for draggable elements
  const [photoPositions, setPhotoPositions] = useState<Record<number, PhotoPosition>>({});
  const [templatePosition, setTemplatePosition] = useState<TemplatePosition>({
    x: 0,
    y: 200,
    width: 720,
    height: 400,
  });
  const [textFieldPosition, setTextFieldPosition] = useState<TextFieldPosition>({
    x: 0,
    y: 427,
    width: 720,
    height: 853,
  });
  const [logos, setLogos] = useState<LogoItem[]>([]);
  const [dates, setDates] = useState<DateItem[]>([]);
  const [selectedDateColor, setSelectedDateColor] = useState('#000000');
  const [blurEnabled, setBlurEnabled] = useState(false);
  const [blurAmount, setBlurAmount] = useState(5);

  // Fetch search with case data
  const { data: search, isLoading: searchLoading } = useQuery({
    queryKey: ['search-full', searchId],
    queryFn: () => searchesApi.getFull(Number(searchId)),
    enabled: !!searchId,
  });

  // Fetch existing orientation if in edit or duplicate mode
  const orientationIdToLoad = isEditMode ? orientationId : duplicateId;
  const { data: existingOrientation, isLoading: orientationLoading } = useQuery({
    queryKey: ['orientation', orientationIdToLoad],
    queryFn: () => orientationsApi.get(Number(orientationIdToLoad)),
    enabled: (isEditMode || isDuplicateMode) && !!orientationIdToLoad,
  });

  // Fetch main templates
  const { data: mainTemplates } = useQuery({
    queryKey: ['flyer-templates', 'main'],
    queryFn: () => flyerTemplatesApi.list({ template_type: 'main', is_active: 1 }),
  });

  // Fetch additional templates
  const { data: additionalTemplates } = useQuery({
    queryKey: ['flyer-templates', 'additional'],
    queryFn: () => flyerTemplatesApi.list({ template_type: 'additional', is_active: 1 }),
  });

  // Fetch logo templates
  const { data: logoTemplates } = useQuery({
    queryKey: ['flyer-templates', 'logo'],
    queryFn: () => flyerTemplatesApi.list({ template_type: 'logo', is_active: 1 }),
  });

  // Upload photo mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const urls = await uploadApi.uploadImages([file]);
      return urls[0];
    },
    onSuccess: (photoUrl: string) => {
      setSelectedPhotos([...selectedPhotos, photoUrl]);
      // Invalidate case query to refresh photos
      queryClient.invalidateQueries({ queryKey: ['case', search?.case_id] });
    },
  });

  // Create orientation mutation
  const createMutation = useMutation({
    mutationFn: () => {
      const data = {
        search_id: Number(searchId),
        template_id: selectedTemplateId || undefined,
        selected_photos: selectedPhotos,
        canvas_data: {
          ...canvasData,
          photoPositions,
          templatePosition,
          textFieldPosition,
          textFormatting: {
            fontSize,
            textAlign,
            textColor,
          },
          verticalTexts: {
            city: { text: cityText, position: cityPosition },
            date: { text: dateText, position: datePosition },
          },
          logos,
          dates,
          blur: {
            enabled: blurEnabled,
            amount: blurAmount,
          },
        },
        text_content: textContent,
        is_approved: isApproved,
        exported_files: exportedFiles,
      };
      return orientationsApi.create(data);
    },
    onSuccess: () => {
      // Invalidate search query to refresh orientations list
      queryClient.invalidateQueries({ queryKey: ['search-full', searchId] });
      navigate(`/searches/${searchId}`);
    },
  });

  // Update orientation mutation
  const updateMutation = useMutation({
    mutationFn: () => {
      const data = {
        template_id: selectedTemplateId || undefined,
        selected_photos: selectedPhotos,
        canvas_data: {
          ...canvasData,
          photoPositions,
          templatePosition,
          textFieldPosition,
          textFormatting: {
            fontSize,
            textAlign,
            textColor,
          },
          verticalTexts: {
            city: { text: cityText, position: cityPosition },
            date: { text: dateText, position: datePosition },
          },
          logos,
          dates,
          blur: {
            enabled: blurEnabled,
            amount: blurAmount,
          },
        },
        text_content: textContent,
        is_approved: isApproved,
        exported_files: exportedFiles,
      };
      return orientationsApi.update(Number(orientationId), data);
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['search-full', searchId] });
      queryClient.invalidateQueries({ queryKey: ['orientation', orientationId] });
      navigate(`/searches/${searchId}`);
    },
  });

  const saveMutation = isEditMode ? updateMutation : createMutation;

  // Auto-populate text from case data (only in create mode, not in edit or duplicate)
  useEffect(() => {
    if (search?.case && !isEditMode && !isDuplicateMode) {
      const c = search.case;

      // Calculate age if birthdate is available
      let ageText = '';
      if (c.missing_birthdate) {
        const birthDate = new Date(c.missing_birthdate);
        const today = new Date();
        const age = today.getFullYear() - birthDate.getFullYear();
        ageText = `, ${age} років`;
      }

      const fullName = `${c.missing_last_name} ${c.missing_first_name} ${c.missing_middle_name || ''}${ageText}`;
      const autoTextHTML = `<div style="text-align: center;">
<div style="color: #FF0000; font-size: 60px; text-decoration: underline; font-weight: bold; margin-top: -30px; margin-bottom: 25px; line-height: 0.8;">${fullName}</div>
<div style="font-size: 35px; font-weight: bold; letter-spacing: -0.05em; line-height: 1.0;">Мешканець: ${c.missing_settlement || ''} ${c.missing_region || ''}</div>
<div style="font-size: 35px; font-weight: bold; letter-spacing: -0.05em; line-height: 1.0;">Дата та час зникнення: ${c.missing_last_seen_datetime ? new Date(c.missing_last_seen_datetime).toLocaleString('uk-UA') : 'не вказано'}</div>
<div style="font-size: 35px; font-weight: bold; letter-spacing: -0.05em; line-height: 1.0;">Місце зникнення: ${c.missing_last_seen_place || ''}</div>
<div style="font-size: 35px; font-weight: bold; letter-spacing: -0.05em; line-height: 1.0;">Обставини: ${c.disappearance_circumstances || ''}</div>
<div style="font-size: 35px; font-weight: bold; letter-spacing: -0.05em; line-height: 1.0;">Прикмети: ${c.missing_description || ''}</div>
<div style="font-size: 35px; font-weight: bold; letter-spacing: -0.05em; line-height: 1.0;">Одяг: ${c.missing_clothing || ''}</div>
<div style="font-size: 35px; font-weight: bold; letter-spacing: -0.05em; line-height: 1.0;">З собою: ${c.missing_belongings || ''}</div>
<div style="font-size: 35px; font-weight: bold; letter-spacing: -0.05em; line-height: 1.0;">Особливі прикмети: ${c.missing_special_signs || ''}</div>
<div style="color: #800020; font-size: 37px; font-weight: bold; text-decoration: underline; letter-spacing: -0.05em; line-height: 1.1;">${c.missing_diseases || ''}</div>
</div>`;

      setTextContent(autoTextHTML);

      // Auto-populate city text
      if (c.missing_settlement) {
        setCityText(c.missing_settlement);
      }
    }
  }, [search, isEditMode, isDuplicateMode]);

  // Update contentEditable div when textContent changes programmatically
  useEffect(() => {
    if (textEditableRef.current && textEditableRef.current.innerHTML !== textContent) {
      textEditableRef.current.innerHTML = textContent;
    }
  }, [textContent]);

  // Load existing orientation data in edit or duplicate mode
  useEffect(() => {
    if ((isEditMode || isDuplicateMode) && existingOrientation) {
      // Restore basic fields
      setSelectedTemplateId(existingOrientation.template_id || null);
      setSelectedPhotos(existingOrientation.selected_photos || []);
      setTextContent(existingOrientation.text_content || '');
      setIsApproved(existingOrientation.is_approved || false);
      setExportedFiles(existingOrientation.exported_files || []);

      // Restore canvas data
      const savedCanvasData = existingOrientation.canvas_data || {};

      // Restore all canvas data (including additionalTemplate)
      setCanvasData(savedCanvasData);

      if (savedCanvasData.photoPositions) {
        setPhotoPositions(savedCanvasData.photoPositions as Record<number, PhotoPosition>);
      }

      if (savedCanvasData.templatePosition) {
        setTemplatePosition(savedCanvasData.templatePosition as TemplatePosition);
      }

      if (savedCanvasData.textFieldPosition) {
        const savedTextFieldPosition = savedCanvasData.textFieldPosition as TextFieldPosition;
        // Ensure bottom edge is always at canvas bottom (1280px)
        const adjustedY = 1280 - savedTextFieldPosition.height;
        setTextFieldPosition({
          ...savedTextFieldPosition,
          y: adjustedY,
        });
      }

      // Restore text formatting
      if (savedCanvasData.textFormatting) {
        const formatting = savedCanvasData.textFormatting as any;
        if (formatting.fontSize) setFontSize(formatting.fontSize);
        if (formatting.textAlign) setTextAlign(formatting.textAlign);
        if (formatting.textColor) setTextColor(formatting.textColor);
      }

      // Restore vertical texts
      if (savedCanvasData.verticalTexts) {
        const verticalTexts = savedCanvasData.verticalTexts as any;
        if (verticalTexts.city) {
          setCityText(verticalTexts.city.text || '');
          setCityPosition(verticalTexts.city.position || { x: 10, y: 20 });
        }
        if (verticalTexts.date) {
          setDateText(verticalTexts.date.text || '');
          setDatePosition(verticalTexts.date.position || { x: 655, y: 40 });
        }
      }

      // Restore logos
      if (savedCanvasData.logos) {
        setLogos(savedCanvasData.logos as LogoItem[]);
      }

      // Restore dates
      if (savedCanvasData.dates) {
        setDates(savedCanvasData.dates as DateItem[]);
      }

      // Restore blur settings
      if (savedCanvasData.blur) {
        const blurSettings = savedCanvasData.blur as { enabled: boolean; amount: number };
        setBlurEnabled(blurSettings.enabled || false);
        setBlurAmount(blurSettings.amount || 5);
      }
    }
  }, [isEditMode, isDuplicateMode, existingOrientation]);

  // Initialize photo positions when photos are selected
  useEffect(() => {
    selectedPhotos.forEach((_, idx) => {
      if (!photoPositions[idx]) {
        setPhotoPositions(prev => ({
          ...prev,
          [idx]: {
            x: 50 + idx * 30,
            y: 50 + idx * 30,
            width: 200,
            height: 200,
          }
        }));
      }
    });
  }, [selectedPhotos]);

  // Calculate canvas scale to fit container
  useEffect(() => {
    const calculateScale = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const canvasWidth = 720;
        const scale = Math.min(containerWidth / canvasWidth, 1);
        setCanvasScale(scale);
      }
    };

    calculateScale();
    window.addEventListener('resize', calculateScale);
    return () => window.removeEventListener('resize', calculateScale);
  }, []);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && search?.case_id) {
      await uploadMutation.mutateAsync(file);
    }
  };

  const handlePhotoSelect = (photoUrl: string) => {
    if (selectedPhotos.includes(photoUrl)) {
      setSelectedPhotos(selectedPhotos.filter((p) => p !== photoUrl));
    } else {
      setSelectedPhotos([...selectedPhotos, photoUrl]);
    }
  };

  const handleTemplateSelect = (template: FlyerTemplate) => {
    setSelectedTemplateId(template.id);
    setShowTemplateModal(false);
  };

  const handleAdditionalTemplateClick = (template: FlyerTemplate) => {
    // Add additional template to canvas
    const newCanvasData = {
      ...canvasData,
      additionalTemplate: {
        url: template.file_path,
        width: '100%',
      },
    };
    setCanvasData(newCanvasData);
  };

  const handleLogoClick = (logoUrl: string) => {
    // Add logo to canvas - each click adds a new instance
    const newLogo: LogoItem = {
      url: logoUrl,
      x: 50 + logos.length * 20,
      y: 50 + logos.length * 20,
      width: 150,
      height: 150,
    };
    setLogos([...logos, newLogo]);
  };

  const handleLogoDelete = (index: number) => {
    setLogos(logos.filter((_, idx) => idx !== index));
  };

  const handleAddDate = () => {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = today.getFullYear();
    const dateString = `${day}.${month}.${year}р.`;

    const newDate: DateItem = {
      text: dateString,
      x: 50 + dates.length * 20,
      y: 50 + dates.length * 20,
      width: 200,
      height: 50,
      color: selectedDateColor,
    };
    setDates([...dates, newDate]);
  };

  const handleDateDelete = (index: number) => {
    setDates(dates.filter((_, idx) => idx !== index));
  };

  // Generate canvas blob for export/save
  const generateCanvasBlob = async (): Promise<Blob | null> => {
    if (!canvasRef.current) {
      console.error('Canvas ref is not available');
      return null;
    }

    try {
      // Create a temporary static canvas for export
      const tempCanvas = document.createElement('div');
      tempCanvas.style.position = 'absolute';
      tempCanvas.style.left = '-9999px';
      tempCanvas.style.width = '720px';
      tempCanvas.style.height = '1280px';
      tempCanvas.style.backgroundColor = '#ffffff';
      tempCanvas.style.overflow = 'hidden';
      document.body.appendChild(tempCanvas);

      // Add template image if selected (z-index: 1)
      if (selectedTemplateId && mainTemplates && canvasRef.current) {
        // Get real position from canvas DOM
        const templateElement = canvasRef.current.querySelector('img[alt="Template"]');
        const templateRndContainer = templateElement?.closest('.react-draggable');

        // Y position correction for export (adjust this value if needed)
        const Y_CORRECTION = 100;

        let realY = templatePosition.y;
        if (templateRndContainer) {
          const rect = templateRndContainer.getBoundingClientRect();
          const canvasRect = canvasRef.current.getBoundingClientRect();
          realY = (rect.top - canvasRect.top) / canvasScale;
          console.log(`Real Y from DOM: ${realY}, State Y: ${templatePosition.y}, With correction: ${realY + Y_CORRECTION}`);
        }

        // Apply correction
        realY += Y_CORRECTION;

        const templateUrl = `${import.meta.env.VITE_API_URL || '/api'}${
          mainTemplates.templates.find((t) => t.id === selectedTemplateId)?.file_path
        }`;

        // Load image to get real dimensions
        const templateImg = new Image();
        templateImg.crossOrigin = 'anonymous';
        templateImg.src = templateUrl;

        await new Promise((resolve) => {
          templateImg.onload = resolve;
        });

        // Calculate scaled dimensions (max width 720px, preserve aspect ratio)
        let imgWidth = templateImg.naturalWidth;
        let imgHeight = templateImg.naturalHeight;

        if (imgWidth > 720) {
          const scale = 720 / imgWidth;
          imgWidth = 720;
          imgHeight = imgHeight * scale;
        }

        console.log(`Template natural size: ${templateImg.naturalWidth}x${templateImg.naturalHeight}`);
        console.log(`Template scaled size: ${imgWidth}x${imgHeight}`);

        // Create wrapper div with calculated size and REAL position
        const templateWrapper = document.createElement('div');
        templateWrapper.style.position = 'absolute';
        templateWrapper.style.left = `${templatePosition.x}px`;
        templateWrapper.style.top = `${realY}px`;
        templateWrapper.style.width = `${imgWidth}px`;
        templateWrapper.style.height = `${imgHeight}px`;
        templateWrapper.style.zIndex = '10';

        // Add image with exact dimensions
        templateImg.style.width = '100%';
        templateImg.style.height = '100%';

        templateWrapper.appendChild(templateImg);
        tempCanvas.appendChild(templateWrapper);
      }

      // Add selected photos (z-index: 2)
      console.log('Photo positions from state:', photoPositions);

      if (canvasRef.current) {
        const photoElements = canvasRef.current.querySelectorAll('img[alt^="Selected"]');

        selectedPhotos.forEach((photo, idx) => {
          const position = photoPositions[idx];
          if (!position) {
            console.warn(`No position for photo ${idx}`);
            return;
          }

          // Get real position from DOM
          let realX = position.x;
          let realY = position.y;

          if (photoElements[idx]) {
            const photoRndContainer = photoElements[idx].closest('.react-draggable');
            if (photoRndContainer && canvasRef.current) {
              const rect = photoRndContainer.getBoundingClientRect();
              const canvasRect = canvasRef.current.getBoundingClientRect();
              realX = (rect.left - canvasRect.left) / canvasScale;
              realY = (rect.top - canvasRect.top) / canvasScale;
              console.log(`Photo ${idx} - State: (${position.x}, ${position.y}), Real: (${realX}, ${realY})`);
            }
          }

          const photoImg = document.createElement('img');
          photoImg.src = `${import.meta.env.VITE_API_URL || '/api'}${photo}`;
          photoImg.style.position = 'absolute';
          photoImg.style.left = `${realX}px`;
          photoImg.style.top = `${realY}px`;
          photoImg.style.width = `${position.width}px`;
          photoImg.style.height = `${position.height}px`;
          photoImg.style.objectFit = 'cover';
          photoImg.style.zIndex = '2';
          photoImg.crossOrigin = 'anonymous';
          if (blurEnabled) {
            photoImg.style.filter = `blur(${blurAmount}px)`;
          }
          tempCanvas.appendChild(photoImg);
        });
      }

      // Add logos (z-index: 3, above photos)
      if (canvasRef.current) {
        const logoElements = canvasRef.current.querySelectorAll('img[alt^="Logo"]');

        logos.forEach((logo, idx) => {
          // Get real position from DOM
          let realX = logo.x;
          let realY = logo.y;

          if (logoElements[idx]) {
            const logoRndContainer = logoElements[idx].closest('.react-draggable');
            if (logoRndContainer && canvasRef.current) {
              const rect = logoRndContainer.getBoundingClientRect();
              const canvasRect = canvasRef.current.getBoundingClientRect();
              realX = (rect.left - canvasRect.left) / canvasScale;
              realY = (rect.top - canvasRect.top) / canvasScale;
              console.log(`Logo ${idx} - State: (${logo.x}, ${logo.y}), Real: (${realX}, ${realY})`);
            }
          }

          const logoImg = document.createElement('img');
          logoImg.src = `${import.meta.env.VITE_API_URL || '/api'}${logo.url}`;
          logoImg.style.position = 'absolute';
          logoImg.style.left = `${realX}px`;
          logoImg.style.top = `${realY}px`;
          logoImg.style.width = `${logo.width}px`;
          logoImg.style.height = `${logo.height}px`;
          logoImg.style.objectFit = 'contain';
          logoImg.style.opacity = '0.2';
          logoImg.style.zIndex = '3';
          logoImg.crossOrigin = 'anonymous';
          if (blurEnabled) {
            logoImg.style.filter = `blur(${blurAmount}px)`;
          }
          tempCanvas.appendChild(logoImg);
        });
      }

      // Add text field (z-index: 4)
      const TEXT_Y_CORRECTION = 150;

      const textDiv = document.createElement('div');
      textDiv.style.position = 'absolute';
      textDiv.style.left = `${textFieldPosition.x}px`;
      textDiv.style.top = `${textFieldPosition.y + TEXT_Y_CORRECTION}px`;
      textDiv.style.width = `${textFieldPosition.width}px`;
      textDiv.style.height = `${textFieldPosition.height}px`;
      textDiv.style.padding = '16px';
      textDiv.style.backgroundColor = '#ffffff';
      textDiv.style.border = '1px solid #d1d5db';
      textDiv.style.fontFamily = 'sans-serif';
      textDiv.style.overflow = 'hidden';
      textDiv.style.zIndex = '4';
      if (blurEnabled) {
        textDiv.style.filter = `blur(${blurAmount}px)`;
      }
      textDiv.innerHTML = textContent;
      tempCanvas.appendChild(textDiv);
      console.log(`Text field - State Y: ${textFieldPosition.y}, With correction: ${textFieldPosition.y + TEXT_Y_CORRECTION}`);

      // Add vertical city text (red, z-index: 5)
      const VERTICAL_TEXT_Y_CORRECTION = 200;
      const VERTICAL_TEXT_X_CORRECTION = -10;
      const cityDiv = document.createElement('div');
      cityDiv.style.position = 'absolute';
      cityDiv.style.left = `${cityPosition.x + VERTICAL_TEXT_X_CORRECTION}px`;
      cityDiv.style.top = `${cityPosition.y + VERTICAL_TEXT_Y_CORRECTION}px`;
      cityDiv.style.width = '200px';
      cityDiv.style.height = '40px';
      cityDiv.style.transform = 'rotate(-90deg)';
      cityDiv.style.transformOrigin = 'top left';
      cityDiv.style.fontSize = '34px';
      cityDiv.style.fontWeight = 'bold';
      cityDiv.style.color = '#FF0000';
      cityDiv.style.textAlign = 'center';
      cityDiv.style.lineHeight = '40px';
      cityDiv.style.zIndex = '5';
      if (blurEnabled) {
        cityDiv.style.filter = `blur(${blurAmount}px)`;
      }
      cityDiv.textContent = cityText;
      tempCanvas.appendChild(cityDiv);

      // Add vertical date text (black, z-index: 5)
      const verticalDateDiv = document.createElement('div');
      verticalDateDiv.style.position = 'absolute';
      verticalDateDiv.style.left = `${datePosition.x + VERTICAL_TEXT_X_CORRECTION}px`;
      verticalDateDiv.style.top = `${datePosition.y + VERTICAL_TEXT_Y_CORRECTION}px`;
      verticalDateDiv.style.width = '200px';
      verticalDateDiv.style.height = '40px';
      verticalDateDiv.style.transform = 'rotate(-90deg)';
      verticalDateDiv.style.transformOrigin = 'top left';
      verticalDateDiv.style.fontSize = '34px';
      verticalDateDiv.style.fontWeight = 'bold';
      verticalDateDiv.style.color = '#000000';
      verticalDateDiv.style.textAlign = 'center';
      verticalDateDiv.style.lineHeight = '40px';
      verticalDateDiv.style.zIndex = '5';
      if (blurEnabled) {
        verticalDateDiv.style.filter = `blur(${blurAmount}px)`;
      }
      verticalDateDiv.textContent = dateText;
      tempCanvas.appendChild(verticalDateDiv);

      // Add additional template if exists (z-index: 4)
      if (canvasData.additionalTemplate) {
        const additionalImg = document.createElement('img');
        additionalImg.src = `${import.meta.env.VITE_API_URL || '/api'}${
          (canvasData.additionalTemplate as { url: string }).url
        }`;
        additionalImg.style.position = 'absolute';
        additionalImg.style.bottom = '0';
        additionalImg.style.left = '0';
        additionalImg.style.width = '100%';
        additionalImg.style.zIndex = '4';
        additionalImg.crossOrigin = 'anonymous';
        if (blurEnabled) {
          additionalImg.style.filter = `blur(${blurAmount}px)`;
        }
        tempCanvas.appendChild(additionalImg);
      }

      // Add dates (z-index: 999, TOPMOST LAYER - above everything)
      // Store real positions for later use in blur redraw
      const datesRealPositions: Array<{x: number, y: number, width: number, height: number, text: string, color: string}> = [];
      if (canvasRef.current) {
        const dateElements = canvasRef.current.querySelectorAll('[class*="border-green-500"]');

        dates.forEach((dateItem, idx) => {
          // Get real position from DOM
          let realX = dateItem.x;
          let realY = dateItem.y;

          if (dateElements[idx]) {
            const dateRndContainer = dateElements[idx];
            if (dateRndContainer && canvasRef.current) {
              const rect = dateRndContainer.getBoundingClientRect();
              const canvasRect = canvasRef.current.getBoundingClientRect();
              realX = (rect.left - canvasRect.left) / canvasScale;
              realY = (rect.top - canvasRect.top) / canvasScale;
              console.log(`Date ${idx} - State: (${dateItem.x}, ${dateItem.y}), Real: (${realX}, ${realY})`);
            }
          }

          // Store real position for blur redraw
          datesRealPositions.push({
            x: realX,
            y: realY,
            width: dateItem.width,
            height: dateItem.height,
            text: dateItem.text,
            color: dateItem.color,
          });

          const dateDiv = document.createElement('div');
          dateDiv.style.position = 'absolute';
          dateDiv.style.left = `${realX}px`;
          dateDiv.style.top = `${realY}px`;
          dateDiv.style.width = `${dateItem.width}px`;
          dateDiv.style.height = `${dateItem.height}px`;
          dateDiv.style.display = 'flex';
          dateDiv.style.alignItems = 'center';
          dateDiv.style.justifyContent = 'center';
          dateDiv.style.fontSize = '38px';
          dateDiv.style.fontWeight = 'bold';
          dateDiv.style.color = dateItem.color;
          dateDiv.style.zIndex = '999';
          dateDiv.textContent = dateItem.text;
          tempCanvas.appendChild(dateDiv);
        });
      }

      // Wait for images to load
      await new Promise(resolve => setTimeout(resolve, 500));

      // Capture the temporary canvas
      const canvas = await html2canvas(tempCanvas, {
        backgroundColor: '#ffffff',
        scale: 1,
        useCORS: true,
        logging: false,
        width: 720,
        height: 1280,
        ignoreElements: (_element) => {
          // Ignore elements that shouldn't be captured
          return false;
        },
        onclone: (clonedDoc) => {
          // Convert oklch colors to rgb for compatibility with html2canvas
          const allElements = clonedDoc.querySelectorAll('*');
          allElements.forEach((element) => {
            const htmlElement = element as HTMLElement;
            const computedStyle = window.getComputedStyle(element);

            // Fix background color if it uses oklch
            if (computedStyle.backgroundColor && computedStyle.backgroundColor.includes('oklch')) {
              htmlElement.style.backgroundColor = 'rgb(255, 255, 255)';
            }

            // Fix text color if it uses oklch
            if (computedStyle.color && computedStyle.color.includes('oklch')) {
              htmlElement.style.color = 'rgb(0, 0, 0)';
            }

            // Fix border color if it uses oklch
            if (computedStyle.borderColor && computedStyle.borderColor.includes('oklch')) {
              htmlElement.style.borderColor = 'rgb(209, 213, 219)';
            }

            // Ensure blur filter is preserved
            if (computedStyle.filter && computedStyle.filter !== 'none') {
              htmlElement.style.filter = computedStyle.filter;
            }
          });
        },
      });

      // Remove temporary canvas
      document.body.removeChild(tempCanvas);

      // Apply blur if enabled
      let finalCanvas = canvas;
      if (blurEnabled) {
        // Create a new canvas for applying blur
        const blurCanvas = document.createElement('canvas');
        blurCanvas.width = canvas.width;
        blurCanvas.height = canvas.height;
        const ctx = blurCanvas.getContext('2d');

        if (ctx) {
          // Apply blur filter
          ctx.filter = `blur(${blurAmount}px)`;
          ctx.drawImage(canvas, 0, 0);
          ctx.filter = 'none';

          // Redraw main template without blur
          if (selectedTemplateId && mainTemplates) {
            const template = mainTemplates.templates.find((t) => t.id === selectedTemplateId);
            if (template) {
              const templateImg = new Image();
              templateImg.crossOrigin = 'anonymous';
              templateImg.src = `${import.meta.env.VITE_API_URL || '/api'}${template.file_path}`;

              await new Promise((resolve) => {
                templateImg.onload = resolve;
              });

              const Y_CORRECTION = 100;
              let imgWidth = templateImg.naturalWidth;
              let imgHeight = templateImg.naturalHeight;

              if (imgWidth > 720) {
                const scale = 720 / imgWidth;
                imgWidth = 720;
                imgHeight = imgHeight * scale;
              }

              ctx.drawImage(templateImg, templatePosition.x, templatePosition.y + Y_CORRECTION, imgWidth, imgHeight);
            }
          }

          // Redraw dates without blur using real positions
          // Apply Y correction to match html2canvas rendering
          const DATE_Y_CORRECTION = -29;
          datesRealPositions.forEach((datePos) => {
            ctx.font = `bold 38px sans-serif`;
            ctx.fillStyle = datePos.color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(datePos.text, datePos.x + datePos.width / 2, datePos.y + datePos.height / 2 + DATE_Y_CORRECTION);
          });

          finalCanvas = blurCanvas;
        }
      }

      // Convert canvas to blob and return it
      return new Promise<Blob | null>((resolve) => {
        finalCanvas.toBlob((blob) => {
          resolve(blob);
        }, 'image/jpeg', 0.95);
      });
    } catch (error) {
      console.error('Error generating canvas blob:', error);
      return null;
    }
  };

  // Export orientation to device (download only)
  const handleExport = async () => {
    const blob = await generateCanvasBlob();
    if (!blob) {
      console.error('Failed to generate canvas blob');
      return;
    }

    // Generate filename with missing person name and timestamp
    const missingName = search?.case?.missing_last_name || 'orientation';
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `${missingName}_${timestamp}.jpg`;

    // Trigger local download
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    link.click();

    // Clean up
    URL.revokeObjectURL(url);
  };

  const handleSave = async () => {
    // Generate and upload JPEG before saving
    const blob = await generateCanvasBlob();
    if (!blob) {
      console.error('Failed to generate canvas blob for saving');
      saveMutation.mutate();
      return;
    }

    // Generate filename with missing person name and timestamp
    const missingName = search?.case?.missing_last_name || 'orientation';
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `${missingName}_${timestamp}.jpg`;

    // Create File object from blob for upload
    const file = new File([blob], filename, { type: 'image/jpeg' });

    try {
      // Upload to backend
      const uploadedPaths = await uploadApi.uploadImages([file]);

      if (uploadedPaths && uploadedPaths.length > 0) {
        // Update exportedFiles state with the new file
        setExportedFiles([...exportedFiles, uploadedPaths[0]]);
        console.log('File uploaded successfully:', uploadedPaths[0]);

        // Small delay to ensure state is updated
        setTimeout(() => {
          saveMutation.mutate();
        }, 100);
      } else {
        // If upload failed, still save without the file
        saveMutation.mutate();
      }
    } catch (uploadError) {
      console.error('Error uploading file to backend:', uploadError);
      // Still save even if upload failed
      saveMutation.mutate();
    }
  };

  if (searchLoading || ((isEditMode || isDuplicateMode) && orientationLoading)) {
    return <Loading text={(isEditMode || isDuplicateMode) ? "Завантаження орієнтування..." : "Завантаження пошуку..."} />;
  }

  if (!search) {
    return <div>Пошук не знайдено</div>;
  }

  const casePhotos = search.case?.missing_photos || [];

  return (
    <div className="min-h-screen pb-nav">
      <Header title={isEditMode ? "Редагувати орієнтування" : "Створити орієнтування"} showBack />

      <Container className="py-6 space-y-6">
        {/* Template Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Шаблон орієнтування</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setShowTemplateModal(true)}>
              <FileImage className="h-4 w-4 mr-2" />
              {selectedTemplateId ? 'Змінити шаблон' : 'Вибрати шаблон'}
            </Button>
            {selectedTemplateId && (
              <p className="text-sm text-gray-600 mt-2">
                Шаблон #{selectedTemplateId} вибрано
              </p>
            )}
          </CardContent>
        </Card>

        {/* Photos Section */}
        <Card>
          <CardHeader>
            <CardTitle>Фотографії</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Upload new photo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Завантажити нове фото
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                disabled={uploadMutation.isPending}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-medium
                  file:bg-primary-50 file:text-primary-700
                  hover:file:bg-primary-100"
              />
            </div>

            {/* Existing photos */}
            {casePhotos.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Фото із заявки (клікніть для вибору)
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {casePhotos.map((photo, idx) => (
                    <div
                      key={idx}
                      onClick={() => handlePhotoSelect(photo)}
                      className={`relative aspect-square rounded-lg border-2 cursor-pointer transition-all ${
                        selectedPhotos.includes(photo)
                          ? 'border-primary-500 ring-2 ring-primary-200'
                          : 'border-gray-200 hover:border-primary-300'
                      }`}
                    >
                      <img
                        src={`${import.meta.env.VITE_API_URL || '/api'}${photo}`}
                        alt={`Photo ${idx + 1}`}
                        className="w-full h-full object-cover rounded-lg"
                      />
                      {selectedPhotos.includes(photo) && (
                        <div className="absolute top-2 right-2 bg-primary-500 rounded-full p-1">
                          <Check className="h-4 w-4 text-white" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Additional Templates */}
        {additionalTemplates && additionalTemplates.templates.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Додаткові шаблони</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                {additionalTemplates.templates.map((template) => (
                  <div
                    key={template.id}
                    onClick={() => handleAdditionalTemplateClick(template)}
                    className="relative aspect-square rounded-lg border border-gray-200 cursor-pointer hover:border-primary-500 transition-all"
                  >
                    <img
                      src={`${import.meta.env.VITE_API_URL || '/api'}${template.file_path}`}
                      alt={template.file_name}
                      className="w-full h-full object-contain rounded-lg"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Logos */}
        {logoTemplates && logoTemplates.templates.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Логотип</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                {logoTemplates.templates.map((template) => (
                  <div
                    key={template.id}
                    onClick={() => handleLogoClick(template.file_path)}
                    className="relative aspect-square rounded-lg border border-gray-200 cursor-pointer hover:border-primary-500 transition-all"
                  >
                    <img
                      src={`${import.meta.env.VITE_API_URL || '/api'}${template.file_path}`}
                      alt={template.file_name}
                      className="w-full h-full object-contain rounded-lg"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Add Date */}
        <Card>
          <CardHeader>
            <CardTitle>Додати дату</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 items-center">
              <Button onClick={handleAddDate} className="flex-1">
                Додати дату
              </Button>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Колір:</label>
                <input
                  type="color"
                  value={selectedDateColor}
                  onChange={(e) => setSelectedDateColor(e.target.value)}
                  className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Blur Orientation */}
        <Card>
          <CardHeader>
            <CardTitle>Розмити орієнтування</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => setBlurEnabled(!blurEnabled)}
                  variant={blurEnabled ? "primary" : "outline"}
                  className="flex-1"
                >
                  {blurEnabled ? 'Вимкнути розмиття' : 'Увімкнути розмиття'}
                </Button>
              </div>
              {blurEnabled && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Ступінь розмиття: {blurAmount}px
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={blurAmount}
                    onChange={(e) => setBlurAmount(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Слабке (1px)</span>
                    <span>Сильне (20px)</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Canvas Editor */}
        <Card>
          <CardHeader>
            <CardTitle>Редактор орієнтування</CardTitle>
            <p className="text-xs text-gray-500 mt-1">Перетягуйте та змінюйте розмір елементів</p>
          </CardHeader>
          <CardContent ref={containerRef}>
            <div className="flex flex-col items-center">
              <div
                style={{
                  width: `${720 * canvasScale}px`,
                  height: `${1280 * canvasScale}px`,
                }}
              >
                <div
                  style={{
                    width: '720px',
                    height: '1280px',
                    transform: `scale(${canvasScale})`,
                    transformOrigin: 'top left',
                  }}
                >
              <div
                ref={canvasRef}
                className="relative bg-white border-2 border-gray-300 overflow-hidden"
                style={{
                  width: '720px',
                  height: '1280px',
                }}
              >
              {/* Template image - draggable vertically and resizable by height */}
              {selectedTemplateId && mainTemplates && (
                <Rnd
                  size={{ width: 720, height: templatePosition.height }}
                  position={{ x: 0, y: templatePosition.y }}
                  onDragStop={(_e, d) => {
                    setTemplatePosition(prev => ({ ...prev, x: 0, y: d.y }));
                  }}
                  onResizeStop={(_e, _direction, ref, _delta, position) => {
                    setTemplatePosition({
                      x: 0,
                      y: position.y,
                      width: 720,
                      height: parseInt(ref.style.height),
                    });
                  }}
                  enableResizing={{
                    top: true,
                    bottom: true,
                    left: false,
                    right: false,
                    topLeft: false,
                    topRight: false,
                    bottomLeft: false,
                    bottomRight: false,
                  }}
                  dragAxis="y"
                  bounds="parent"
                  className="border border-dashed border-blue-300"
                >
                  <img
                    src={`${import.meta.env.VITE_API_URL || '/api'}${
                      mainTemplates.templates.find((t) => t.id === selectedTemplateId)?.file_path
                    }`}
                    alt="Template"
                    className="w-full h-full object-contain pointer-events-none"
                  />
                </Rnd>
              )}

              {/* Selected photos - draggable and resizable */}
              {selectedPhotos.map((photo, idx) => {
                const position = photoPositions[idx] || { x: 50, y: 50, width: 200, height: 200 };
                return (
                  <Rnd
                    key={idx}
                    size={{ width: position.width, height: position.height }}
                    position={{ x: position.x, y: position.y }}
                    onDragStop={(_e, d) => {
                      setPhotoPositions(prev => ({
                        ...prev,
                        [idx]: { ...prev[idx], x: d.x, y: d.y }
                      }));
                    }}
                    onResizeStop={(_e, _direction, ref, _delta, pos) => {
                      setPhotoPositions(prev => ({
                        ...prev,
                        [idx]: {
                          x: pos.x,
                          y: pos.y,
                          width: parseInt(ref.style.width),
                          height: parseInt(ref.style.height),
                        }
                      }));
                    }}
                    bounds="parent"
                    className="border-2 border-primary-500"
                  >
                    <img
                      src={`${import.meta.env.VITE_API_URL || '/api'}${photo}`}
                      alt={`Selected ${idx + 1}`}
                      className="w-full h-full object-cover pointer-events-none"
                      style={blurEnabled ? { filter: `blur(${blurAmount}px)` } : {}}
                    />
                  </Rnd>
                );
              })}

              {/* Logos - draggable and resizable, above photos */}
              {logos.map((logo, idx) => (
                <Rnd
                  key={`logo-${idx}`}
                  size={{ width: logo.width, height: logo.height }}
                  position={{ x: logo.x, y: logo.y }}
                  onDragStop={(_e, d) => {
                    setLogos(prev => prev.map((item, i) =>
                      i === idx ? { ...item, x: d.x, y: d.y } : item
                    ));
                  }}
                  onResizeStop={(_e, _direction, ref, _delta, pos) => {
                    setLogos(prev => prev.map((item, i) =>
                      i === idx ? {
                        ...item,
                        x: pos.x,
                        y: pos.y,
                        width: parseInt(ref.style.width),
                        height: parseInt(ref.style.height),
                      } : item
                    ));
                  }}
                  bounds="parent"
                  className="border-2 border-blue-500"
                  style={{ zIndex: 10 }}
                >
                  <div className="relative w-full h-full">
                    <img
                      src={`${import.meta.env.VITE_API_URL || '/api'}${logo.url}`}
                      alt={`Logo ${idx + 1}`}
                      className="w-full h-full object-contain pointer-events-none"
                      style={blurEnabled ? { opacity: 0.2, filter: `blur(${blurAmount}px)` } : { opacity: 0.2 }}
                    />
                    <button
                      onMouseDown={(e) => {
                        e.stopPropagation();
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleLogoDelete(idx);
                      }}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 text-xs font-bold pointer-events-auto cursor-pointer"
                      style={{ zIndex: 100, pointerEvents: 'auto' }}
                    >
                      ×
                    </button>
                  </div>
                </Rnd>
              ))}

              {/* Dates - draggable only, above logos */}
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {dates.map((dateItem, idx) => (
                <Rnd
                  key={`date-${idx}`}
                  size={{ width: dateItem.width, height: dateItem.height }}
                  position={{ x: dateItem.x, y: dateItem.y }}
                  onDragStop={(_e, d) => {
                    setDates(prev => prev.map((item, i) =>
                      i === idx ? { ...item, x: d.x, y: d.y } : item
                    ));
                  }}
                  enableResizing={false}
                  bounds="parent"
                  className="border-2 border-green-500"
                  style={{ zIndex: 15 }}
                >
                  <div className="relative w-full h-full flex items-center justify-center">
                    <div
                      className="font-bold pointer-events-none"
                      style={{
                        fontSize: '38px',
                        color: dateItem.color,
                      }}
                    >
                      {dateItem.text}
                    </div>
                    <button
                      onMouseDown={(e) => {
                        e.stopPropagation();
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleDateDelete(idx);
                      }}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 text-xs font-bold pointer-events-auto cursor-pointer"
                      style={{ zIndex: 100, pointerEvents: 'auto' }}
                    >
                      ×
                    </button>
                  </div>
                </Rnd>
              )) as any}

              {/* Text field - resizable */}
              <Rnd
                size={{ width: textFieldPosition.width, height: textFieldPosition.height }}
                position={{ x: textFieldPosition.x, y: textFieldPosition.y }}
                disableDragging={true}
                enableResizing={{
                  top: true,
                  bottom: false,
                  left: false,
                  right: false,
                  topLeft: false,
                  topRight: false,
                  bottomLeft: false,
                  bottomRight: false,
                }}
                onResizeStop={(_e, _direction, ref, _delta, _position) => {
                  const newHeight = parseInt(ref.style.height);
                  const newY = 1280 - newHeight;
                  setTextFieldPosition({
                    width: parseInt(ref.style.width),
                    height: newHeight,
                    x: textFieldPosition.x,
                    y: newY,
                  });
                }}
                bounds="parent"
                className="bg-white border border-gray-300 relative"
              >
                {/* Formatting toolbar - at top */}
                <div className="absolute top-0 left-0 right-0 border-b border-gray-300 p-2 flex gap-2 items-center flex-wrap z-10" style={{ backgroundColor: 'rgba(249, 250, 251, 0.9)' }}>
                  <select
                    onChange={(e) => {
                      document.execCommand('fontSize', false, '7');
                      const fontElements = document.querySelectorAll('font[size="7"]');
                      fontElements.forEach((el) => {
                        el.removeAttribute('size');
                        (el as HTMLElement).style.fontSize = e.target.value + 'px';
                      });
                    }}
                    className="px-2 py-1 border border-gray-300 rounded text-sm bg-white"
                    defaultValue=""
                  >
                    <option value="" disabled>Розмір</option>
                    <option value="20">20px</option>
                    <option value="28">28px</option>
                    <option value="35">35px</option>
                    <option value="40">40px</option>
                    <option value="50">50px</option>
                    <option value="60">60px</option>
                  </select>

                  <input
                    type="color"
                    onChange={(e) => document.execCommand('foreColor', false, e.target.value)}
                    className="w-8 h-8 border border-gray-300 rounded cursor-pointer bg-white"
                    title="Колір тексту"
                  />

                  <button
                    onClick={() => document.execCommand('bold')}
                    className="px-3 py-1 border border-gray-300 rounded font-bold hover:bg-gray-200 bg-white"
                    title="Жирний"
                  >
                    B
                  </button>

                  <button
                    onClick={() => document.execCommand('italic')}
                    className="px-3 py-1 border border-gray-300 rounded italic hover:bg-gray-200 bg-white"
                    title="Курсив"
                  >
                    I
                  </button>

                  <button
                    onClick={() => document.execCommand('underline')}
                    className="px-3 py-1 border border-gray-300 rounded underline hover:bg-gray-200 bg-white"
                    title="Підкреслений"
                  >
                    U
                  </button>

                  <div className="w-px h-6 bg-gray-300"></div>

                  <button
                    onClick={() => document.execCommand('justifyLeft')}
                    className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-200 bg-white"
                    title="По лівому краю"
                  >
                    ≡
                  </button>

                  <button
                    onClick={() => document.execCommand('justifyCenter')}
                    className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-200 bg-white"
                    title="По центру"
                  >
                    ≡
                  </button>

                  <button
                    onClick={() => document.execCommand('justifyRight')}
                    className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-200 bg-white"
                    title="По правому краю"
                  >
                    ≡
                  </button>

                  <button
                    onClick={() => document.execCommand('justifyFull')}
                    className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-200 bg-white"
                    title="По ширині"
                  >
                    ≡
                  </button>
                </div>

                <div className="w-full h-full overflow-auto p-4" style={{ paddingTop: '60px' }}>
                  <div
                    ref={textEditableRef}
                    contentEditable
                    onInput={(e) => setTextContent(e.currentTarget.innerHTML)}
                    className="w-full border-none outline-none font-sans"
                    style={{
                      lineHeight: '1.1',
                      minHeight: '100%',
                      filter: blurEnabled ? `blur(${blurAmount}px)` : 'none',
                    }}
                  />
                </div>
              </Rnd>

              {/* Vertical text field - City (red) */}
              <Rnd
                position={{ x: cityPosition.x, y: cityPosition.y }}
                onDragStop={(_e, d) => {
                  setCityPosition({ x: d.x, y: d.y });
                }}
                enableResizing={false}
                bounds="parent"
                className="bg-transparent"
                style={{ width: '40px', height: '200px' }}
              >
                <div
                  style={{
                    width: '200px',
                    height: '40px',
                    transform: 'rotate(-90deg)',
                    transformOrigin: 'top left',
                    position: 'absolute',
                    top: '200px',
                    left: '0px',
                  }}
                >
                  <input
                    type="text"
                    value={cityText}
                    onChange={(e) => setCityText(e.target.value)}
                    className="w-full h-full border-none outline-none bg-transparent font-sans font-bold"
                    style={{
                      fontSize: '34px',
                      color: '#FF0000',
                      textAlign: 'center',
                      filter: blurEnabled ? `blur(${blurAmount}px)` : 'none',
                    }}
                    placeholder="Місто"
                  />
                </div>
              </Rnd>

              {/* Vertical text field - Date (black) */}
              <Rnd
                position={{ x: datePosition.x, y: datePosition.y }}
                disableDragging={true}
                enableResizing={false}
                bounds="parent"
                className="bg-transparent"
                style={{ width: '40px', height: '200px' }}
              >
                <div
                  style={{
                    width: '200px',
                    height: '40px',
                    transform: 'rotate(-90deg)',
                    transformOrigin: 'top left',
                    position: 'absolute',
                    top: '200px',
                    left: '0px',
                  }}
                >
                  <input
                    type="text"
                    value={dateText}
                    onChange={(e) => setDateText(e.target.value)}
                    className="w-full h-full border-none outline-none bg-transparent font-sans font-bold"
                    style={{
                      fontSize: '34px',
                      color: '#000000',
                      textAlign: 'center',
                      filter: blurEnabled ? `blur(${blurAmount}px)` : 'none',
                    }}
                    placeholder="Дата"
                  />
                </div>
              </Rnd>

              {/* Additional template at bottom */}
              {canvasData.additionalTemplate && (
                <div
                  className="absolute bottom-0 left-0"
                  style={{ width: '100%', pointerEvents: 'none' }}
                >
                  <img
                    src={`${import.meta.env.VITE_API_URL || '/api'}${
                      (canvasData.additionalTemplate as { url: string }).url
                    }`}
                    alt="Additional"
                    className="w-full"
                    style={blurEnabled ? { filter: `blur(${blurAmount}px)` } : {}}
                  />
                </div>
              )}
                </div>
                </div>
              </div>

              {/* Text formatting toolbar */}
              <div className="mt-4 w-full space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  {/* Font size */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Розмір шрифту
                    </label>
                    <input
                      type="number"
                      value={fontSize}
                      onChange={(e) => setFontSize(Number(e.target.value))}
                      min="12"
                      max="72"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>

                  {/* Text align */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Вирівнювання
                    </label>
                    <select
                      value={textAlign}
                      onChange={(e) => setTextAlign(e.target.value as 'left' | 'center' | 'right')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="left">По лівому краю</option>
                      <option value="center">По центру</option>
                      <option value="right">По правому краю</option>
                    </select>
                  </div>

                  {/* Text color */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Колір тексту
                    </label>
                    <input
                      type="color"
                      value={textColor}
                      onChange={(e) => setTextColor(e.target.value)}
                      className="w-full h-10 border border-gray-300 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Approval and Export */}
        <Card>
          <CardContent className="space-y-4 pt-6">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isApproved}
                onChange={(e) => setIsApproved(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Узгоджено (орієнтування готове до використання)
              </span>
            </label>

            <div className="flex gap-3">
              <Button onClick={handleExport} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Експорт у JPEG
              </Button>

              <Button
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="ml-auto"
              >
                <Upload className="h-4 w-4 mr-2" />
                {saveMutation.isPending ? 'Збереження...' : 'Зберегти орієнтування'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </Container>

      {/* Template Selection Modal */}
      {showTemplateModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowTemplateModal(false)}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4">Вибрати шаблон орієнтування</h2>
            {mainTemplates && mainTemplates.templates.length > 0 ? (
              <div className="grid grid-cols-3 gap-4">
                {mainTemplates.templates.map((template) => (
                  <div
                    key={template.id}
                    onClick={() => handleTemplateSelect(template)}
                    className="relative aspect-square rounded-lg border-2 border-gray-200 cursor-pointer hover:border-primary-500 transition-all"
                  >
                    <img
                      src={`${import.meta.env.VITE_API_URL || '/api'}${template.file_path}`}
                      alt={template.file_name}
                      className="w-full h-full object-contain rounded-lg"
                    />
                    <p className="text-xs text-center mt-1 truncate">{template.file_name}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600">Шаблони не знайдено. Завантажте їх у налаштуваннях.</p>
            )}
            <div className="mt-4 flex justify-end">
              <Button variant="outline" onClick={() => setShowTemplateModal(false)}>
                Закрити
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
